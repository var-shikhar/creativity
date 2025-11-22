# Contributing to PulseAPI

Thank you for your interest in contributing to PulseAPI! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behavior includes**:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards others

**Unacceptable behavior includes**:
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Git
- Basic knowledge of React and Node.js

### Development Setup

1. **Fork the repository**

Click the "Fork" button on GitHub to create your own copy.

2. **Clone your fork**

```bash
git clone https://github.com/YOUR_USERNAME/creativity.git
cd creativity
```

3. **Add upstream remote**

```bash
git remote add upstream https://github.com/ORIGINAL_OWNER/creativity.git
```

4. **Install dependencies**

```bash
npm run install:all
```

5. **Set up environment**

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit the `.env` files with your local configuration.

6. **Set up database**

```bash
createdb pulseapi
npm run migrate
```

7. **Start development servers**

```bash
npm run dev
```

## Development Workflow

### Creating a Branch

Create a feature branch from `main`:

```bash
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or changes

### Making Changes

1. **Write code** following our [coding standards](#coding-standards)
2. **Test your changes** thoroughly
3. **Commit frequently** with clear messages
4. **Keep commits atomic** (one logical change per commit)

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:

```
feat(monitors): add support for POST request monitoring

- Allow users to configure POST requests
- Add request body configuration
- Update validation logic

Closes #123
```

```
fix(incidents): resolve WebSocket reconnection issue

The WebSocket connection was not properly reconnecting
after network interruption. Added exponential backoff
and improved error handling.

Fixes #456
```

### Testing

Before submitting:

1. **Run tests**:
```bash
npm test
```

2. **Test manually**:
- Test your changes in the browser
- Verify all affected features work
- Check responsive design

3. **Test edge cases**:
- Empty states
- Error conditions
- Long text/numbers
- Different user roles

## Coding Standards

### JavaScript/Node.js

- Use ES6+ features
- Use `const` by default, `let` when necessary, avoid `var`
- Use arrow functions for callbacks
- Use async/await over promises when possible
- Handle errors properly (don't ignore them)
- Add comments for complex logic

**Example**:
```javascript
// Good
const fetchUserData = async (userId) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    return rows[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw error;
  }
};

// Bad
function fetchUserData(userId) {
  return db.query('SELECT * FROM users WHERE id = ' + userId)
    .then(result => result.rows[0])
    .catch(() => null); // Silent failure!
}
```

### React/Frontend

- Use functional components
- Use hooks (useState, useEffect, etc.)
- Extract reusable logic into custom hooks
- Keep components small and focused
- Use PropTypes or TypeScript for type checking
- Avoid inline styles (use Tailwind classes)

**Example**:
```javascript
// Good
const MonitorCard = ({ monitor, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(monitor.id);
    } catch (error) {
      toast.error('Failed to delete monitor');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="card">
      <h3>{monitor.name}</h3>
      <button onClick={handleDelete} disabled={isDeleting}>
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  );
};
```

### Database

- Use parameterized queries (never string concatenation)
- Create indexes for frequently queried columns
- Use transactions for multi-step operations
- Add appropriate constraints (NOT NULL, UNIQUE, etc.)
- Document schema changes in migration files

**Example**:
```javascript
// Good
const createUser = async (email, passwordHash) => {
  const { rows } = await db.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
    [email, passwordHash]
  );
  return rows[0].id;
};

// Bad - SQL injection vulnerability!
const createUser = async (email, passwordHash) => {
  await db.query(
    `INSERT INTO users (email, password_hash) VALUES ('${email}', '${passwordHash}')`
  );
};
```

### Code Style

- **Indentation**: 2 spaces
- **Line length**: Max 100 characters
- **Quotes**: Single quotes for strings
- **Semicolons**: Use them
- **Trailing commas**: Use in multi-line objects/arrays

Run the linter before committing:
```bash
npm run lint
```

## Submitting Changes

### Pull Request Process

1. **Update your branch**

```bash
git checkout main
git pull upstream main
git checkout your-feature-branch
git rebase main
```

2. **Push to your fork**

```bash
git push origin your-feature-branch
```

3. **Create Pull Request**

- Go to GitHub and click "New Pull Request"
- Select your fork and branch
- Fill out the PR template
- Link related issues

### Pull Request Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] I have tested these changes locally
- [ ] I have added tests that prove my fix/feature works
- [ ] All new and existing tests passed

## Checklist
- [ ] My code follows the project's coding standards
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have checked my code for security issues

## Related Issues
Closes #(issue number)

## Screenshots (if applicable)
```

### Review Process

1. **Automated checks** will run (tests, linting)
2. **Code review** by maintainers
3. **Address feedback** if requested
4. **Approval** from at least one maintainer
5. **Merge** by maintainers

## Reporting Bugs

### Before Submitting

1. **Check existing issues** - your bug may already be reported
2. **Try latest version** - the bug might be fixed
3. **Search closed issues** - it might have been addressed

### Bug Report Template

```markdown
## Bug Description
Clear and concise description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## Expected Behavior
What you expected to happen

## Actual Behavior
What actually happened

## Screenshots
If applicable, add screenshots

## Environment
- OS: [e.g. Ubuntu 20.04]
- Browser: [e.g. Chrome 96]
- Node.js version: [e.g. 18.0.0]
- PulseAPI version: [e.g. 1.0.0]

## Additional Context
Any other relevant information
```

## Feature Requests

We welcome feature suggestions! Please:

1. **Check existing requests** first
2. **Describe the use case** clearly
3. **Explain the expected behavior**
4. **Consider alternatives** you've explored

### Feature Request Template

```markdown
## Feature Description
Clear description of the feature

## Use Case
Who would use this and why?

## Proposed Solution
How should this feature work?

## Alternatives Considered
Other solutions you've thought about

## Additional Context
Mockups, examples, or other details
```

## Questions?

- **Documentation**: Check the [docs/](docs/) folder
- **Discussions**: Use GitHub Discussions for questions
- **Email**: development@pulseapi.dev

## Recognition

Contributors will be:
- Listed in our README
- Mentioned in release notes
- Given credit in commit history

Thank you for contributing to PulseAPI! 🚀
