# Design

## Product Overview
SWOT Coach is an AI-driven personal growth application for students. It combines chat, reflection, and structured SWOT tracking into one system.

## Design Principles
- conversational first
- minimal cognitive load
- transparent AI decisions
- mobile and desktop friendly
- visually clear and calm
- progress-oriented rather than judgmental

## Information Architecture

### Screen 1: Landing / Login / Onboarding
Purpose:
- explain the product
- authenticate the user
- collect profile information through a chat-like setup

Sections:
- hero message
- sign in / sign up
- short intro cards
- onboarding chat panel

### Screen 2: SWOT Dashboard
Purpose:
- show live SWOT profile

Layout:
- 4 quadrant grid
- each quadrant contains cards
- card shows title, confidence, recency, status
- click card to open detail drawer or modal

Item Detail:
- description
- evidence list
- version history
- trend chart
- user notes
- controls to edit, merge, or archive

### Screen 3: Chat Coach
Purpose:
- daily communication and progress tracking

Layout:
- left or bottom chat panel on desktop
- full-screen chat on mobile
- assistant messages and user messages
- suggestions and action chips

## Visual Hierarchy
- Primary focus: current action and latest insight
- Secondary focus: dashboard status
- Tertiary focus: archived or historical data

## Component Library
- input fields
- chat bubbles
- confidence badges
- SWOT cards
- timeline components
- progress bars
- compact action chips
- modal/drawer
- activity cards
- notification banners

## State Model
### SWOT Item States
- active
- uncertain
- stale
- retired

### Confidence Levels
- low
- medium
- high

### Evidence Types
- self-reported
- task-based
- mentor feedback
- project progress
- behavior pattern
- test / assessment

## Interaction Design
- every important update should be explainable
- user should be able to confirm or reject a suggestion
- major updates should show “why this changed”
- chat should surface one clear next step, not many

## Responsive Behavior
### Mobile
- single-column layout
- tab navigation between dashboard and chat
- bottom action area
- full-width cards

### Desktop
- split view possible
- dashboard left, chat right
- larger version history and analytics view

## AI Behavior Design
The assistant should:
- remember recent goals
- ask short, relevant questions
- connect current activity to long-term growth
- avoid overclaiming
- prefer evidence over assumptions
- update SWOT only when confidence is sufficient

## Data Visualization
- quadrant cards for SWOT
- line chart for confidence over time
- timeline for version history
- bar chart for active items by category

## Design Constraints
- no cluttered screen
- no more than 3 primary actions per screen
- fast loading
- accessible contrast
- readable typography