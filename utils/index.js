import fs from "fs";
import { app } from "electron";
import path from "path";
// ============================================
// Folder handling
// ============================================

export function getDirectoryStatus(dirPath) {
  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return { exists: true, isDirectory: false, isEmpty: null };
    }
    const files = fs.readdirSync(dirPath);
    return { exists: true, isDirectory: true, isEmpty: files.length === 0 };
  } catch (err) {
    if (err.code === "ENOENT") {
      return { exists: false, isDirectory: false, isEmpty: null };
    }
    throw err;
  }
}

export function readJsonFilesFromFolder(folderPath) {
  const files = fs.readdirSync(folderPath);

  return files
    .filter((file) => path.extname(file).toLowerCase() === ".json")
    .map((file) => {
      const filePath = path.join(folderPath, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      return {
        filename: file,
        data: JSON.parse(fileContent),
      };
    });
}

// ============================================
// AI Agents History
// ============================================
const agentsHistoryPath = path.join(app.getPath("userData"), "agents_history");

function getAgentHistoryFolder(agentId) {
  return path.join(agentsHistoryPath, agentId.toString());
}

function getChatSessionPath(agentId, sessionId) {
  return path.join(getAgentHistoryFolder(agentId), `${sessionId}.json`);
}

function ensureAgentFolder(agentId) {
  const folderPath = getAgentHistoryFolder(agentId);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return folderPath;
}

/**
 * Read ALL chat sessions for an agent
 * Returns an array of all ChatSession objects from the agent's folder
 */
export function readAgentHistories(agentId) {
  try {
    const folderPath = getAgentHistoryFolder(agentId);

    // If folder doesn't exist, return empty array
    if (!fs.existsSync(folderPath)) {
      return [];
    }

    // Read all files in the agent's folder
    const files = fs.readdirSync(folderPath);

    // Filter for JSON files and parse each one
    const sessions = [];

    for (const file of files) {
      // Only process .json files
      if (path.extname(file).toLowerCase() !== ".json") {
        continue;
      }

      try {
        const filePath = path.join(folderPath, file);
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const session = JSON.parse(fileContent);
        sessions.push(session);
      } catch (parseError) {
        // Skip files that can't be parsed
        console.error(`Failed to parse ${file}:`, parseError);
      }
    }

    // Sort by updatedAt (most recent first)
    sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    return sessions;
  } catch (error) {
    console.error("Failed to read agent histories:", error);
    return [];
  }
}

/**
 * Read a SINGLE chat session by agentId and sessionId
 */
export function readAgentHistory(agentId, sessionId) {
  try {
    const filePath = getChatSessionPath(agentId, sessionId);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to read agent history:", error);
    return null;
  }
}

/**
 * Write/Save a chat session
 * Creates the agent folder if it doesn't exist
 */
export function writeAgentHistory(chatSession) {
  try {
    // Ensure the agent's folder exists
    ensureAgentFolder(chatSession.agentId);

    // Write the session file
    const filePath = getChatSessionPath(chatSession.agentId, chatSession.id);
    fs.writeFileSync(filePath, JSON.stringify(chatSession, null, 2), "utf-8");

    return true;
  } catch (error) {
    console.error("Failed to write agent history:", error);
    return false;
  }
}

/**
 * Delete a single chat session
 */
export function deleteAgentHistory(agentId, sessionId) {
  try {
    const filePath = getChatSessionPath(agentId, sessionId);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return true;
  } catch (error) {
    console.error("Failed to delete agent history:", error);
    return false;
  }
}

/**
 * Delete ALL chat history for an agent (deletes the entire folder)
 */
export function deleteAllAgentHistories(agentId) {
  try {
    const folderPath = getAgentHistoryFolder(agentId);

    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
    }

    return true;
  } catch (error) {
    console.error("Failed to delete all agent histories:", error);
    return false;
  }
}
