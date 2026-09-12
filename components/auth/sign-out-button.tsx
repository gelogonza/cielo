/**
 * Sign out. The Figma library header has no account affordance, so this sits
 * beside the Save button as the least intrusive placement — move it once the
 * design has somewhere it belongs.
 */
export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="text-muted hover:text-primary-text h-11 rounded-full px-3 text-sm transition sm:h-[55px] sm:px-4 sm:text-base"
      >
        Sign out
      </button>
    </form>
  );
}
