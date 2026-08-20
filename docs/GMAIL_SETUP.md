# Gmail Integration Setup Guide

This guide explains how to set up the Google Cloud Project and credentials required to enable the Gmail features in MosAIc.

## Prerequisites

- A Google Account (Gmail)
- Access to the [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar and select **New Project**.
3. Name the project (e.g., "MosAIc Companion") and click **Create**.
4. Select the newly created project.

## Step 2: Enable the Gmail API

1. In the left navigation menu, go to **APIs & Services > Library**.
2. Search for "Gmail API".
3. Click on **Gmail API** and then click **Enable**.

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**.
2. Select **External** (unless you are a G Suite user and want to restrict it to your organization) and click **Create**.
3. Fill in the required App Information:
   - **App name**: MosAIc Companion
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Click **Save and Continue**.
5. **Scopes**: Click **Add or Remove Scopes**.
   - Search for and select `https://www.googleapis.com/auth/gmail.modify` (or `.../auth/gmail.readonly` if you don't need write access, but MosAIc uses `modify` to mark emails as read).
   - Click **Update**.
   - Click **Save and Continue**.
6. **Test Users**:
   - Click **Add Users**.
   - Enter your own Gmail address (and any others you want to test with).
   - Click **Add** and then **Save and Continue**.
   - *Note: This is critical since the app is in "Testing" mode.*

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials** and select **OAuth client ID**.
3. For **Application type**, select **Desktop app**.
4. Name it "MosAIc Desktop Client".
5. Click **Create**.

## Step 5: Install Credentials

1. In the "OAuth client created" popup (or from the Credentials list), look for the "Download JSON" button (usually a download icon).
2. Download the JSON file.
3. Rename the downloaded file to: `gmail-credentials.json`.
4. Move this file into the `config/` directory in the root of your MosAIc project.
   - Project Path: `mosaic-companion/config/gmail-credentials.json`

## Step 6: Verify

1. Restart the MosAIc application.
2. Go to the Gmail section (or click the Mail icon).
3. The app should detect the credentials and prompt you to log in securely via your browser.
