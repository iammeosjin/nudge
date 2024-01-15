create sa simple slack integration that runs every 2 minutes or if possible with
less interval that will send reminder:

- when all subtasks are done but the acceptance testing card still in "backlog"
  status
- when all subtasks are done including the acceptance testing but the parent
  card still in "In Progress" status
- when there are parent card that are not in progress status but have children
  that are already in progress
- when card don't have assignee
- when pull request is in stale for more than 5 minutes
- when there are pending pull request or subtasks on the closing hours

Github GraphQL: https://api.github.com/graphql
