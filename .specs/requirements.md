# Requirements

## Product Name
SkillVista

## Goal
Build a cross-platform AI-powered student companion that continuously tracks personal strengths, weaknesses, opportunities, and threats through conversation, daily check-ins, and task progress.

## Problem Statement
Students often do not clearly understand:
- what they are good at
- what they struggle with
- what opportunities they should pursue
- what threats may affect their long-term growth

Static self-assessments become outdated. A living system is needed to help users discover and update their personal SWOT over time.

## Objectives
- Help users identify strengths and weaknesses accurately
- Track changes in personal growth over time
- Maintain a living SWOT profile with version history
- Use chat as the main interface for reflection and progress tracking
- Support both mobile and desktop
- Keep the user focused on actionable improvement

## Target Users
- college students
- engineering students from FY to LY
- career-focused learners
- users preparing for internships, placements, and projects

## Core User Flows

### 1. Onboarding
- user signs up or logs in
- user completes conversational registration
- system collects academic background, goals, interests, habits, and current challenges

### 2. Chat Coach
- user chats with the system daily
- system asks follow-up questions
- system tracks progress on goals and tasks
- system updates SWOT signals in the background

### 3. SWOT Dashboard
- user views 4 quadrants
- user opens each SWOT item
- user sees evidence, trend, and version history
- user can correct, merge, or remove an item

### 4. Progress Tracking
- system tracks changes over time
- system marks items as active, stale, or retired
- system shows how a weakness or threat evolves

## Functional Requirements

### Authentication
- email/password login
- OTP or Google login
- session persistence

### Onboarding
- conversational onboarding UI
- ability to collect structured profile data
- editable profile after signup

### Chat
- natural conversation
- context awareness
- proactive check-ins
- follow-up questions
- progress nudges
- concise and helpful replies

### SWOT System
- store SWOT items by category
- attach evidence to each item
- maintain version history
- confidence scoring
- staleness detection
- item retirement
- manual override by user

### Analytics
- progress over time
- item confidence trend
- user activity streaks
- completed tasks
- category distribution

### Notifications
- daily or weekly reminders
- missed task nudges
- reflection prompts
- summary updates

### Accessibility and Devices
- responsive UI for phone and desktop
- keyboard accessible
- readable on small screens
- fast loading experience

## Non-Functional Requirements
- low latency chat experience
- scalable backend
- secure storage of user data
- audit logs for updates
- modular architecture
- explainable AI outputs
- reliable background processing

## Data Requirements
- user profile data
- chat messages
- SWOT items
- SWOT item versions
- evidence records
- goals and tasks
- notification history

## Security Requirements
- hashed passwords
- encrypted sensitive data
- authenticated APIs
- role-based access if admin panel exists
- user data export and deletion

## Acceptance Criteria
- user can register through a conversational form
- user can chat and receive context-aware responses
- SWOT board updates based on valid evidence
- outdated items become stale or retired
- item history is visible
- app works well on mobile and desktop
- progress is saved across sessions

## MVP Deliverables
- frontend application
- backend APIs
- database schema
- AI integration layer
- SWOT dashboard
- chat interface
- onboarding flow
- analytics view