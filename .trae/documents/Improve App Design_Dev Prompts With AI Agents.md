## Objectives
- Make your prompts clearer, more actionable, and tailored for different AI/design/engineering roles.
- Ensure prompts capture business goals, constraints (RTL, accessibility, print), and deliverables.

## Approach
- Use read-only agents to research prompt-engineering best practices for:
  - UI design (Figma workflows)
  - Front-end implementation (vanilla React + CSS)
  - Accessibility and RTL
  - Print-ready report layouts
- Synthesize findings into role-specific prompt templates and acceptance criteria.

## Deliverables
- Three refined prompts:
  1) Design Prompt (Figma + interaction specs)
  2) Engineering Prompt (implementation + validation)
  3) QA/Review Prompt (heuristics + checklists)
- One-line executive brief prompt for rapid direction.
- A reusable prompt “frame” with slots for scope, constraints, tokens, and outputs.

## Steps
### 1) Audit Current Prompts
- Identify gaps: missing acceptance criteria, insufficient constraints, unclear success measures.

### 2) Research (Read-Only)
- Collect guidance on:
  - Figma component libraries and handoff practices
  - Material/Carbon/HIG layout and typography standards
  - WCAG/RTL patterns, keyboard nav, focus visible
  - Print layout conventions (A4, signature spacing, table readability)

### 3) Draft Role-Specific Prompts
- Design: role, audience, goals, constraints, tokens, layouts, deliverables, non-goals.
- Engineering: role, tasks, constraints (no deps, RTL, responsive), validation plan.
- QA/Review: checklists for accessibility, performance, usability, print, RTL.

### 4) Acceptance Criteria & Checklists
- Add measurable success criteria for each prompt (e.g., AA contrast, keyboard navigable dropdown, print spacing).

### 5) Create Prompt Frame Template
- A structured template with mandatory sections (Role, Context, Objectives, Constraints, Deliverables, Validation) that you can reuse across tasks.

### 6) Output
- Provide refined prompts and short variants ready to copy-paste into AI tools (design copilots, code copilots, QA tools).

## Next
- On approval, I will run the read-only agents to gather best practices and deliver the refined prompts and templates. Would you like me to proceed?