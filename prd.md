# MindBase PRD

## Project Overview

`MindBase` is a private, AI-powered note vault built for engineers who want one place to capture ideas, research, decisions, and working context. At its core, it combines a clean note editor with autosave, tags, image attachments, AI-generated summaries and titles, and semantic search so users can find notes by meaning instead of exact keywords. The product is positioned like a "second brain" for technical people: less about generic note-taking and more about storing and retrieving useful context while building software. It is a single-user workspace today, with authentication and per-user data isolation baked into the experience. In simple terms: `MindBase` helps engineers write things down quickly, organize them automatically, and resurface them later when they matter.

## High-Level Summary

`MindBase` is a modern web app concept built around private note-taking, AI-assisted organization, and fast retrieval of knowledge. The main product loop is straightforward: sign in, create a note, write freely, let the app auto-save, optionally let AI organize the note, attach images, and later retrieve that note either through filters or semantic search.

What makes it feel like more than a basic notes app is the organization layer. Notes support tags, AI-generated summaries, and embeddings for meaning-based search. That means the product solves not just "where do I write this down?" but also "how do I find and reuse my thinking later?"

The initial version of `MindBase` should stay intentionally focused on personal knowledge management rather than collaboration. Billing, team workspaces, shared editing, and version history are outside the initial scope and can be explored later if the core product proves valuable.

## Product Name

`MindBase`

## Product Summary

`MindBase` is an AI-assisted personal knowledge vault for engineers. It gives users a private space to capture notes, attach supporting images, organize information with tags and AI-generated metadata, and retrieve knowledge through both traditional filtering and semantic search.

## Problem Statement

Engineers constantly accumulate fragmented context across docs, tabs, chats, snippets, and half-finished ideas. Traditional note apps are good at storage but weak at recall, structure, and fast retrieval of technical context. `MindBase` aims to reduce that friction by making notes easy to capture, intelligently organized, and meaningfully searchable.

## Target Users

- Individual engineers
- Indie hackers and builders
- Technical founders
- Developers doing research, planning, debugging, or architecture work

## Jobs To Be Done

- "When I have an idea or important context, I want to capture it quickly before I lose it."
- "When I come back later, I want to find the right note even if I do not remember the exact words."
- "When my notes get messy, I want the app to help organize them without rewriting my content."
- "When I am working on something technical, I want notes, supporting images, and tags in one place."

## Core Value Proposition

A private second brain for engineers that combines note-taking, lightweight asset storage, AI organization, and semantic retrieval in one focused product.

## MVP Scope

- User authentication
- Private per-user notes
- Create, edit, and delete notes
- Debounced autosave
- Tags for organization and filtering
- Image uploads per note
- AI auto-organize for title, summary, and tags
- Semantic search via embeddings
- Light/dark theme support
- Dynamic Open Graph images for notes

## Primary User Flow

1. User lands on the homepage and understands the value proposition.
2. User signs in or signs up.
3. User enters the `/notes` workspace and sees their note library.
4. User creates a new note with title, content, and optional tags.
5. User is redirected into the note editor.
6. User edits freely while the app auto-saves changes.
7. User can add or remove tags and upload images.
8. User can run `Auto-organize` to generate a cleaner title, summary, and tags.
9. Later, the user finds notes either by keyword filters or semantic search with `Cmd+K` / `Ctrl+K`.

## Key Features

### 1. Notes Workspace

A dedicated notes hub where users browse all notes, see recent activity, and filter by search query or tags.

### 2. Rich Note Editing

Each note has a focused editor with title, body, metadata, autosave state, and deletion flow.

### 3. AI Auto-Organize

The app can analyze note content and generate:

- A better title
- A short summary
- A small set of tags

This improves organization without changing the underlying note content.

### 4. Semantic Search

Users can search notes by meaning rather than exact text using embeddings and vector search. This is one of the strongest differentiators in the product.

### 5. Image Attachments

Users can upload up to 10 images per note, giving notes a lightweight documentation or reference capability.

### 6. Private User Data

The app is designed as a private vault. Authentication and row-level data isolation are core to the product story.

## Product Principles

- Fast capture over heavy structure
- AI should organize, not get in the way
- Private by default
- Search should work even when memory fails
- Clean interface for technical users

## What The Product Is Not

- Not a team collaboration tool
- Not a full documentation wiki
- Not a project management app
- Not a billing-enabled SaaS yet
- Not a version-controlled notebook with history or restore

## Functional Requirements

- Users must be able to authenticate and access only their own notes.
- Users must be able to create, edit, and delete notes.
- Notes must support title, content, summary, tags, and images.
- Notes must auto-save after edits.
- Users must be able to filter notes by text and tags.
- Users must be able to semantically search notes through a command palette.
- Users must be able to run AI organization on sufficiently long notes.
- Image uploads must validate file type and size.

## Non-Functional Requirements

- Editing should feel responsive and uninterrupted.
- Search should feel fast enough for command-palette usage.
- Data access should remain isolated per user.
- AI responses should be structured and constrained.
- The UI should work well in light and dark mode.

## Success Metrics

- Notes created per active user
- Weekly returning users
- Percentage of notes later revisited
- Usage rate of AI auto-organize
- Usage rate of semantic search
- Search-to-click conversion rate
- Average time from note creation to first meaningful edit
- Low save failure rate

## Target Technical Shape

- Frontend: `Next.js` App Router + `React` + `TypeScript`
- Backend: `InsForge`
- Data model: `notes`, `tags`, `note_tags`, `note_images`, `note_embeddings`
- AI: chat completion for organization, embeddings for search
- Storage: note image bucket
- Auth model: authenticated single-user vault

Phase One: **Project setup**

- create the app
- install core dependencies
- define folder structure
- set basic design direction
