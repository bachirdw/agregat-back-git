import { createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { readConfined, writeConfined } from '../policy-engine/files.js';

const address = z
  .string()
  .email()
  .max(254)
  .refine((s) => !/[\r\n]/.test(s));
export const emailSchema = z
  .object({
    id: z.string().uuid(),
    to: address,
    subject: z
      .string()
      .min(1)
      .max(500)
      .refine((s) => !/[\r\n]/.test(s)),
    text: z.string().min(1).max(20000),
    attachments: z.array(z.string().uuid()).max(8).default([]),
  })
  .strict();
export function smtpConfig(env = process.env) {
  if (!env.CAREER_SMTP_HOST) return null;
  const port = Number(env.CAREER_SMTP_PORT || 465);
  const local = env.CAREER_SMTP_HOST === '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port SMTP invalide');
  address.parse(env.CAREER_SMTP_FROM);
  return {
    host: env.CAREER_SMTP_HOST,
    port,
    secure: !local && port === 465,
    requireTLS: !local,
    ...(env.CAREER_SMTP_USER
      ? { auth: { user: env.CAREER_SMTP_USER, pass: env.CAREER_SMTP_PASSWORD } }
      : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    from: env.CAREER_SMTP_FROM,
  };
}
export function gmailCompose(email) {
  return (
    'https://mail.google.com/mail/?' +
    new URLSearchParams({ view: 'cm', fs: '1', to: email.to, su: email.subject, body: email.text })
  );
}
export function linkedInDraft({ url, text }) {
  const target = new URL(url);
  if (
    target.protocol !== 'https:' ||
    !/^(www\.)?linkedin\.com$/.test(target.hostname) ||
    target.username ||
    target.password ||
    target.port ||
    !/^\/(in|messaging)\//.test(target.pathname)
  )
    throw new Error('Profil ou conversation LinkedIn HTTPS requis');
  if (typeof text !== 'string' || !text.trim() || text.length > 20000)
    throw new Error('Brouillon LinkedIn invalide');
  return { url: target.href, text, manualSendOnly: true };
}

// Single in-flight request per workspace/id. A durable reservation is written BEFORE SMTP;
// errors are uncertain and never automatically retried (SMTP cannot promise exactly-once delivery).
const pending = new Set();
export class EmailGateway {
  constructor({
    career,
    approve = async () => false,
    meter = () => {},
    config = smtpConfig(),
    transportFactory = nodemailer.createTransport,
  }) {
    Object.assign(this, { career, approve, meter, config, transportFactory });
  }
  async send(raw, signal) {
    const email = emailSchema.parse(raw);
    const root = this.career.path();
    const files = this.career.attachments(email.attachments).map((f) => ({
      filename: f.name,
      content: readConfined(root, f.path, 10 * 1024 * 1024),
      contentType: f.type,
    }));
    if (files.reduce((sum, f) => sum + f.content.length, 0) > 10 * 1024 * 1024)
      throw new Error('Pièces jointes trop volumineuses');
    const hash = createHash('sha256')
      .update(JSON.stringify(email))
      .update(Buffer.concat(files.map((f) => f.content)))
      .digest('hex');
    const key = root + '/' + email.id;
    if (pending.has(key)) throw new Error('Envoi déjà en cours');
    pending.add(key);
    const journal = `outbox/${email.id}.json`;
    try {
      let previous;
      try {
        previous = JSON.parse(readConfined(root, journal, 100000));
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      if (previous)
        throw new Error(
          'Identifiant déjà utilisé ; vérifier le suivi avant toute nouvelle tentative',
        );
      writeConfined(root, `drafts/${email.id}.json`, JSON.stringify(email));
      if (!this.config)
        return {
          sent: false,
          draft: email.id,
          composeUrl: gmailCompose(email),
          manualSendOnly: true,
        };
      if (signal?.aborted) throw new Error('Envoi annulé');
      const approved = await this.approve({
        capability: 'email.send',
        actionClass: 'send',
        sensitive: true,
        args: {
          ...email,
          from: this.config.from,
          attachments: files.map(({ content, ...f }) => ({ ...f, size: content.length })),
        },
      });
      if (approved !== true || signal?.aborted) throw new Error('Envoi refusé ou annulé');
      await this.meter('tool_call', 1);
      if (signal?.aborted) throw new Error('Envoi annulé');
      writeConfined(root, journal, JSON.stringify({ hash, state: 'uncertain' }));
      const { from, ...config } = this.config;
      const transport = this.transportFactory(config);
      try {
        await transport.sendMail({
          from,
          to: email.to,
          subject: email.subject,
          text: email.text,
          attachments: files,
          messageId: `<${email.id}@relay.local>`,
          disableFileAccess: true,
          disableUrlAccess: true,
        });
      } catch {
        throw new Error('Résultat SMTP incertain ; aucune relance automatique');
      } finally {
        transport.close();
      }
      writeConfined(root, journal, JSON.stringify({ hash, state: 'sent' }));
      return { sent: true, id: email.id };
    } finally {
      pending.delete(key);
    }
  }
}
