// lib/pterodactyl.ts
import SftpClient from "ssh2-sftp-client"

export async function setServerPowerState(signal: "start" | "stop" | "restart") {
  const url = `${process.env.PTERO_URL}/api/client/servers/${process.env.PTERO_SERVER_ID}/power`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PTERO_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ signal })
  });

  if (!response.ok) {
    throw new Error(`Failed to send ${signal} command to server.`);
  }
}

export async function uploadModsViaFTP(localFolderPath: string) {
  const sftp = new SftpClient();
  
  try {
    console.log("Connecting to PebbleHost SFTP...");
    await sftp.connect({
      host: process.env.FTP_HOST,
      port: parseInt(process.env.FTP_PORT || "2222"),
      username: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
    });

    console.log("Connected! Uploading files...");
    
    // Check if the "mods" folder exists on the server, create it if not
    const remotePath = './mods';
    const exists = await sftp.exists(remotePath);
    if (!exists) {
      await sftp.mkdir(remotePath);
    }
    
    // Upload the entire temporary folder containing the .jar files directly into the /mods folder
    await sftp.uploadDir(localFolderPath, remotePath);
    console.log("Upload complete!");

  } catch (error) {
    console.error("SFTP Error:", error);
    throw new Error("Failed to upload mods via SFTP.");
  } finally {
    // Always close the connection when finished
    await sftp.end();
  }
}

// Add this to the BOTTOM of lib/pterodactyl.ts

export async function syncServerData() {
  let detectedVersion = null;
  let installedFiles: string[] = [];

  // 1. Try to get the Minecraft Version from PebbleHost Startup Variables
  try {
    const url = `${process.env.PTERO_URL}/api/client/servers/${process.env.PTERO_SERVER_ID}/startup`;
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${process.env.PTERO_API_KEY}`,
        "Accept": "application/json"
      }
    });
    if (response.ok) {
      const data = await response.json();
      // Look for the standard Pterodactyl environment variable for version
      const versionVar = data.data.find((v: any) => v.attributes.env_variable === "MINECRAFT_VERSION");
      if (versionVar) detectedVersion = versionVar.attributes.server_value;
    }
  } catch (e) {
    console.error("Could not fetch version from Pterodactyl API", e);
  }

  // 2. Use SFTP to literally list the files in the /mods folder
  const sftp = new (require("ssh2-sftp-client"))();
  try {
    await sftp.connect({
      host: process.env.FTP_HOST,
      port: parseInt(process.env.FTP_PORT || "2222"),
      username: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
    });

    const exists = await sftp.exists('./mods');
    if (exists) {
      const list = await sftp.list('./mods');
      // Filter out only .jar files
      installedFiles = list.filter((item: any) => item.name.endsWith('.jar')).map((item: any) => item.name);
    }
  } catch (e) {
    console.error("Could not fetch mods via SFTP", e);
  } finally {
    await sftp.end();
  }

  return { detectedVersion, installedFiles };
}

// Add this to the BOTTOM of lib/pterodactyl.ts

export async function sendServerCommand(command: string) {
  const url = `${process.env.PTERO_URL}/api/client/servers/${process.env.PTERO_SERVER_ID}/command`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PTERO_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ command })
  });

  if (!response.ok) {
    console.error(`Failed to send command to server: ${await response.text()}`);
  }
}