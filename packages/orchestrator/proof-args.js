// E58, seconde relecture de nuit : a call that carries an argument its step's proof excludes
// (`proof.unlessArgs`, « --dry-run ») is a simulation, whatever it printed : it proves nothing.
// The flag itself or its `--flag=value` form. One reader for the gateway's measurement and for
// the router's ACP channel.
export function simulatedBy(proof, args) {
  const given = [args].flat(2).filter((value) => typeof value === 'string');
  return Boolean(
    proof?.unlessArgs?.some((flag) =>
      given.some((value) => value === flag || value.startsWith(`${flag}=`)),
    ),
  );
}
