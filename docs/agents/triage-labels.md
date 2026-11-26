# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.

## Model labels

Every issue labelled `ready-for-agent` also gets exactly one model label, the model recommended to implement it:

| Label          | When                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| `model:sonnet` | A mechanical ticket: a pattern already in the codebase to follow, specs to fill in.      |
| `model:opus`   | Diagnosis of a bug or flaky behaviour, new UI, or a ticket that leaves design decisions. |

Pick it when the issue is created or triaged (for example in `to-tickets`, where each proposed ticket shows its model so the owner can change it before publishing). Only people with triage access can set labels (here, only the owner), so whoever opens an issue cannot choose a costlier model for it.

Who reads it:

- `@claude` on an issue (`.github/workflows/claude.yml`) runs the labelled model. With no label, and on a PR (whose labels are its own, not its issue's), it runs the action's default model.
- `/create-worktree` and `/implement` recommend the labelled model. Without a label, they recommend one by the table above and ask the owner to add it.
