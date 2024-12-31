import { Confirm, Input, Secret, Select } from "@cliffy/prompt";
import {
  createVoalteAllSessionsJSON,
  createVoalteAllUsersJSON,
  createVolateMeSessionExcelFromJSON,
  getSessionTokenJSON,
} from "./calls.ts";
import { VoalteSelection } from "./types.ts";

async function userPrompt() {
  const usernameInp: string = await Input.prompt("Voalte username:");
  const passwordInp: string = await Secret.prompt("Voalte password:");

  return { usernameInp, passwordInp };
}

async function main() {
  console.log("VoalteAdminPal Version 0.7");

  let ADMIN_SESSION_TOKEN: string = "";

  if (await Confirm.prompt("Do you already have an active session token?")) {
    ADMIN_SESSION_TOKEN = await Input.prompt("Session token:");
  } else {
    let authenticated: boolean = false;

    do {
      const { usernameInp, passwordInp } = await userPrompt();

      try {
        const { session_token } = await getSessionTokenJSON(
          usernameInp,
          passwordInp,
        );

        ADMIN_SESSION_TOKEN = session_token;
        authenticated = true;
      } catch (_error) {
        console.log("Failed to get session token... try again");
      }
    } while (!authenticated);
  }

  console.log(`Session token: ${ADMIN_SESSION_TOKEN}`);

  let running: boolean = true;

  do {
    const voalteSelection = await Select.prompt({
      message: "Choose an option:",
      options: [
        {
          name: "Get all users database [voalte-all-users.json] (~2 minutes)",
          value: "ALL_USERS",
        },
        {
          name:
            "Get all VoalteMe user sessions [voalte-all-users-sessions.json] (~10 minutes)",
          value: "VOALTE_ME_SESSIONS",
        },
        {
          name:
            "Create excel report of VoalteMe user sessions [Voalte_Sessions.xlsx]",
          value: "VOALTE_ME_EXCEL",
        },
        {
          name: "Print admin session token",
          value: "SESSION_TOKEN",
        },
        {
          name: "Close application!",
          value: "EXIT",
        },
      ],
    }) as VoalteSelection;

    try {
      switch (voalteSelection) {
        case "ALL_USERS":
          await createVoalteAllUsersJSON(ADMIN_SESSION_TOKEN);
          break;
        case "VOALTE_ME_SESSIONS":
          await createVoalteAllSessionsJSON(ADMIN_SESSION_TOKEN);
          break;
        case "VOALTE_ME_EXCEL":
          await createVolateMeSessionExcelFromJSON();
          break;
        case "SESSION_TOKEN":
          console.log(`Admin session token: ${ADMIN_SESSION_TOKEN}`);
          break;
        case "EXIT":
          running = false;
          break;
        default:
          break;
      }
    } catch (error) {
      console.log(`An error occured: ${error}`);
    }
  } while (running);

  await Input.prompt("Click to close...");
}

await main();
