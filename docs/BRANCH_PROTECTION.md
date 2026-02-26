# Recommended Branch Protection (main)

Apply these repository settings for enterprise-grade merge control:

1. Require pull request before merging.
2. Require approvals: at least 1.
3. Dismiss stale approvals on new commits.
4. Require status checks to pass:
   - `CI / quality`
   - `Security / dependency-audit`
   - `Security / codeql`
5. Require conversation resolution before merge.
6. Require signed commits (optional but recommended).
7. Restrict force pushes and branch deletions.
