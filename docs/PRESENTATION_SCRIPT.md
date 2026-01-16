# MOSAIC Browser - Beta Presentation Script

**Presenter**: Victor  
**Audience**: Community Beta Node Operators (CBNO) & Developer Team  
**Duration**: ~15-20 minutes  
**Date**: [Insert Date]

---

## 1. INTRODUCTION (2-3 minutes)

### Opening

> "Hey everyone! Thanks for joining today. I'm Victor, and I'm excited to show you what we've been building with MOSAIC."

### What is MOSAIC?

> "MOSAIC is an interface to the **Internet of AI** that puts you in control. Unlike traditional AI tools where your data and engagement history disappear into someone else's servers, MOSAIC allows you to **hold on to your own data and engagement history with AI**.
>
> Think of it as your personal AI companion that remembers your conversations, learns your preferences, and integrates with your digital life—all while keeping your data under your control."

### Vision & Evolution

> "Now, I want to be upfront: the capabilities of this initial version are modest. We're at the beginning of the journey. But here's what makes this exciting—**MOSAIC will grow and evolve over time**, particularly with the participation of developers like you.
>
> In fact, what I'm about to show you includes contributions from our team, and soon it will include contributions from the Community Beta Node Operators program—which many of you are part of. This is a collaborative ecosystem, and you're going to be a key part of shaping what MOSAIC becomes."

---

## 2. CORE FEATURES WALKTHROUGH (5-7 minutes)

### A. The Interface Overview

> "Let me give you a quick tour of the interface."

**[DEMO: Open MOSAIC and show the main interface]**

- **Sidebar Navigation**: "On the left, we have our sidebar with quick access to Home, AI Chat, Gmail integration, and Settings."
- **Tab System**: "Just like a traditional browser, we support multiple tabs so you can work with different contexts simultaneously."
- **Unified Input Bar**: "At the bottom, we have a unified input bar with two modes:"
  - **AI Agent Mode**: "When you're in AI Agent mode, your input goes directly to configured AI agents."
  - **Normal Mode**: "In Normal mode, it functions as a traditional browser/search bar."

### B. AI Agent Integration

> "One of the core features is our AI Agent system. You can configure multiple AI agents with different capabilities."

**[DEMO: Navigate to Settings → AI Agents]**

- Show how to add/configure an AI agent
- Demonstrate the API key setup
- Show the agent activation toggle

**[DEMO: Navigate to AI Chat page]**

- Send a sample query to an AI agent
- Show the conversation history
- Highlight how the data is stored locally

> "Notice how your conversation history is preserved. This is YOUR data, stored on YOUR machine. MOSAIC remembers your context across sessions."

### C. Customization & Settings

> "MOSAIC is highly customizable to fit your workflow."

**[DEMO: Navigate to Settings]**

- **Theme Toggle**: "We support both light and dark modes."
- **Custom Home URL**: "You can set your preferred home page."
- **URL Bar Toggle**: "You can show or hide the URL bar for a cleaner AI companion experience."
- **Custom Greeting**: "Personalize your landing page with a custom greeting."

### D. Browser Capabilities

> "At its core, MOSAIC is also a fully functional browser."

**[DEMO: Navigate to a website]**

- Show navigation (back, forward, refresh)
- Demonstrate tab management (new tab, close tab, switch tabs)
- Show how external websites load seamlessly

---

## 3. GMAIL INTEGRATION - MY "FLAVOUR" (5-7 minutes)

> "Now, let me show you the feature I've been working on—the **Gmail Integration**. This is my 'flavour' or contribution to MOSAIC, and it demonstrates the kind of extensibility we're building into the platform."

### What is the Gmail Integration?

> "The Gmail integration allows you to connect your Gmail account directly to MOSAIC and view your recent emails without leaving the interface. But more importantly, it's designed to work **with AI agents** in the future."

### Setup & Authentication

**[DEMO: Navigate to Gmail section]**

> "The first time you use it, you'll need to authenticate with Google using OAuth2."

**[DEMO: Click 'Sign in with Google']**

- Show the browser-based OAuth flow
- Explain the security: "We use Google's official OAuth2 flow. Your credentials never touch our servers—authentication happens directly with Google."
- Show the permissions: "We request the `gmail.modify` scope, which allows us to read emails and mark them as read/unread."

### Features Demonstration

**[DEMO: After authentication]**

1. **Email List View**
   - "Here you can see your 15 most recent emails from your inbox."
   - "Unread emails are highlighted with a blue indicator."
   - "You can see the sender, subject, snippet, and relative timestamp."

2. **Auto-Mark as Read**
   - "There's a setting to automatically mark emails as read when viewed via AI."
   - "This is designed for future integration where an AI agent could read and summarize your emails."

3. **Refresh & Sign Out**
   - "You can manually refresh to fetch new emails."
   - "And you can sign out at any time to disconnect your account."

### The Vision

> "Now, here's where this gets interesting. Right now, you're looking at a simple email viewer. But imagine this:
>
> - An AI agent that can **read your emails** and give you a daily summary.
> - An AI that can **search your emails** based on natural language queries like 'Find emails from John about the project deadline.'
> - An AI that can **draft replies** based on your writing style and conversation history.
> - Integration with **calendar, tasks, and other Google services**.
>
> This Gmail integration is just the beginning—it's a **proof of concept** for how MOSAIC can integrate with your digital life while keeping you in control of your data."

### Technical Implementation

> "For the developers in the room, here's how it works:"

- **OAuth2 Loopback Flow**: "We use a local server on port 3000 to capture the OAuth callback."
- **Token Storage**: "Tokens are stored locally in your user data directory, encrypted by the OS."
- **Gmail API**: "We use the official Google Gmail API with the `googleapis` Node.js library."
- **Electron IPC**: "Communication between the frontend and backend happens via Electron's secure IPC channels."

> "All the code is in the repo. Check out `gmail-auth.js`, `gmail-service.js`, and `GmailClient.tsx` if you want to dive deeper."

---

## 4. OTHER TEAM FLAVOURS (5 minutes)

> "Now, I'm going to hand it over to the other team members to show their individual 'flavours' or features they've been working on."

**[TRANSITION: Pass to next team member]**

- **David's Feature**: [David presents]
- **[Other Developer's Feature]**: [They present]
- **[Other Developer's Feature]**: [They present]

---

## 5. CBNO ACCESS & NEXT STEPS (3-5 minutes)

> "Alright, so you've seen what we've built so far. Now let's talk about how YOU can get access and start contributing."

### How to Get Access

> "For those of you in the **Community Beta Node Operators (CBNO)** program, here's how you can get started:"

1. **Repository Access**
   - "The code is hosted on GitHub at [insert repo URL]."
   - "If you don't have access yet, reach out to [contact person/email] and we'll get you added."

2. **Installation**
   - "Clone the repo and run `./setup.sh` to install dependencies."
   - "You'll need to set up your own Gemini API key in the `.env.local` file."
   - "For Gmail integration, you'll need to create your own Google Cloud Project and OAuth credentials—there's a full guide in `docs/GMAIL_SETUP.md`."

3. **Running Locally**
   - "Run `npm run dev` to start the development server."
   - "Run `npm run start` to build and run the Electron app."

### How to Contribute

> "Here's where it gets exciting. We want YOUR contributions. Here's how you can participate:"

1. **Create Your Own 'Flavour'**
   - "Think about what integration or feature would be valuable to you."
   - "Examples: Slack integration, Notion integration, local file search, calendar sync, task management, etc."
   - "Create a new branch with your feature name (e.g., `your-name-feature-name`)."
   - "Build it, test it, and submit a pull request."

2. **Improve Existing Features**
   - "Found a bug? Fix it."
   - "Have an idea to improve the UI? Go for it."
   - "Want to add more AI agent capabilities? We'd love to see it."

3. **Documentation & Testing**
   - "Help us improve documentation."
   - "Write tests for existing features."
   - "Create tutorials or guides for other developers."

### Support & Community

> "We're building this together, so here's how to stay connected:"

- **GitHub Issues**: "Report bugs or request features."
- **Pull Requests**: "Submit your code for review."
- **[Communication Channel]**: "Join our [Slack/Discord/etc.] for real-time discussions."
- **Weekly Sync**: "We have weekly sync meetings on [day/time] to discuss progress and roadblocks."

### The Bigger Picture

> "Remember, MOSAIC is more than just a browser or an AI chat interface. It's a **platform for the Internet of AI**. Every feature you build, every integration you add, makes MOSAIC more powerful for everyone.
>
> And because your data stays local, because you control your AI interactions, you're not just building a product—you're building a **movement toward user-owned AI experiences**."

---

## 6. Q&A (5-10 minutes)

> "Alright, that's what we have so far. I know there's a lot to digest, so let's open it up for questions."

**Potential Questions to Prepare For:**

1. **"What AI models does MOSAIC support?"**
   - "Currently, we support any OpenAI-compatible API, including Gemini, OpenAI, and local models via OpenRouter or similar services."

2. **"Is my data really private?"**
   - "Yes. All conversation history and tokens are stored locally on your machine. We don't have servers collecting your data."

3. **"Can I use my own AI model?"**
   - "Absolutely. As long as it has an OpenAI-compatible API endpoint, you can configure it in the AI Agents settings."

4. **"What's the roadmap for MOSAIC?"**
   - "We're focused on stability, more integrations, and building out the developer ecosystem. We'll be publishing a public roadmap soon."

5. **"How do I get my OAuth credentials for Gmail?"**
   - "There's a full step-by-step guide in `docs/GMAIL_SETUP.md`. It takes about 10 minutes to set up your Google Cloud Project."

6. **"Can I build commercial features on top of MOSAIC?"**
   - "[Defer to leadership or clarify licensing terms]"

---

## 7. CLOSING (1 minute)

> "Thanks everyone for your time and attention. I'm really excited about what we're building here, and I can't wait to see what you all create.
>
> If you have any questions after this, feel free to reach out to me directly or post in [communication channel]. Let's build the future of AI together!"

---

## PRESENTATION TIPS

### Before the Presentation

- [ ] Test all demos in advance
- [ ] Have a backup plan if OAuth fails (screenshots/video)
- [ ] Ensure your Gmail account has some test emails
- [ ] Clear any sensitive emails from your inbox
- [ ] Have the repo URL ready to share
- [ ] Prepare your screen sharing setup
- [ ] Close unnecessary tabs/applications

### During the Presentation

- **Speak clearly and at a moderate pace**
- **Pause for questions if people seem confused**
- **Show enthusiasm—your energy is contagious**
- **If something breaks, stay calm and move to the next demo**
- **Engage with your audience—make eye contact (if in person)**

### After the Presentation

- **Share the repo link and setup docs**
- **Follow up with anyone who had specific questions**
- **Document any feedback or feature requests**
- **Thank the team for their attention**

---

## ADDITIONAL NOTES

### If Toufi Joins and Takes Over

- **Don't be alarmed!** Your boss mentioned this might happen.
- **Listen and learn**—Toufi has the most fleshed-out vision.
- **Be ready to jump back in** if he asks you to demonstrate something specific.
- **Take notes** on his vision to incorporate into your future work.

### Key Messages to Emphasize

1. **User Data Ownership**: MOSAIC keeps your data local and private.
2. **Extensibility**: The platform is designed for developers to add their own "flavours."
3. **Collaboration**: This is a community effort—everyone's contributions matter.
4. **Evolution**: We're at the beginning—MOSAIC will grow with the community.

---

## **Good luck with your presentation, Victor! You've got this! 🚀**
