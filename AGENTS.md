# Agent guidelines for Match Sketch

## Commits

Make small, atomic commits whose messages follow the Angular convention, so the history reads as a logical story of how the project was built.

### One change per commit

- Each commit holds one logical change: a feature slice, a fix, a refactor, a test addition, a config change. If the message needs "and" to describe two unrelated things, split it.
- Every commit should leave the project working: type check, lint, and tests pass.
- Don't mix concerns. Keep formatting-only, dependency, and refactoring changes out of feature or fix commits, and commit them on their own.
- Order commits so each builds on the one before it. Someone reading `git log` from oldest to newest should be able to follow how the code evolved.

### Message format

```
type(scope): description

Optional body: why the change was made, and anything a reviewer
would not see from the diff alone.

Optional footer: trailers such as Co-Authored-By.
```

- **type**: the kind of change, one of:
  - `feat`: user-facing feature or capability
  - `fix`: bug fix
  - `refactor`: code change that neither fixes a bug nor adds a feature
  - `test`: adding or correcting tests only
  - `docs`: documentation only
  - `style`: formatting only, no code meaning changes
  - `perf`: performance improvement
  - `build`: build system or dependencies
  - `ci`: CI configuration
  - `chore`: tooling and housekeeping that fits none of the above
- **scope**: the area of the codebase the change touches, in lowercase kebab-case. Examples: `editor`, `geometry`, `catalog`, `store`, `canvas-library`, `plans`, `print`, `sync`, `auth`, `deps`, `tooling`, `specs`.
- **description**: imperative mood ("add", not "added" or "adds"), lowercase, no trailing period. Keep the whole first line under 72 characters.
- Mark a breaking change with `!` after the scope (`feat(store)!: …`) and explain it in a `BREAKING CHANGE:` footer.

### Examples

```
feat(geometry): add unit conversion and snapping helpers
test(store): cover soft-deleted plans in listPlans
fix(editor): keep backspace in text fields from deleting objects
refactor(editor): derive viewport instead of syncing it in an effect
build(deps): add dexie and zod
docs(specs): record the scale break decision
chore(tooling): add the Svelte MCP server config
```
