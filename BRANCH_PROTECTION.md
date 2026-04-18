# Branch Protection Recommendations

To maintain the integrity of the `main` branch and ensure the CI/CD pipeline functions effectively, please configure the following Branch Protection Rules in your GitHub repository:

1. Go to your repository **Settings** -> **Branches** -> **Add branch protection rule**.
2. Specify the branch name pattern: `main`.
3. Enable the following settings under the rule:
   - **Require a pull request before merging.**
   - **Require status checks to pass before merging.**
     - In the search bar for status checks, add the following checks exactly as they are named in `ci.yml`:
       - `Lint & Typecheck`
       - `Unit Tests`
       - `Vite Build`
   - **Require branches to be up to date before merging.** This ensures that any pending branch is tested against the latest version of `main`.
   - **Do not allow bypassing the above settings.** (Ensure repo administrators are also subject to these rules to prevent accidental direct pushes and deployments).
   
Enabling these rules ensures that code must successfully compile, pass tests, and pass static analysis before being merged into the codebase, automatically preventing broken builds from executing the deployment workflow to production.
