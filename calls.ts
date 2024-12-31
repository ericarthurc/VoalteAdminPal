import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
import { VoalteResponseJSON } from "./types.ts";

if (!Deno.env.has("VOALTE_DOMAIN")) {
  console.log("missing environmental variables!");
  Deno.exit(0);
}

const VOALTE_DOMAIN = Deno.env.get("VOALTE_DOMAIN");

// take in the user's username and password
// return the admin users session token
export async function getSessionTokenJSON(
  username: string,
  password: string,
): Promise<VoalteResponseJSON> {
  const request = new Request(`https://${VOALTE_DOMAIN}/rest/v2/sessions`, {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
      domain: "voalte.com",
      client_type: "voalte_admin",
    }),
    headers: {
      "content-type": "application/json",
    },
  });

  const response = await fetch(request);

  if (!response.ok) {
    throw new Error(`bad request: ${response.statusText}`);
  }

  return await response.json();
}

// using the session_token return all voalte users
async function getAllUsersJSON(
  session_token: string,
) {
  const request = new Request(
    `https://${VOALTE_DOMAIN}/rest/v2/users/`,
    {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "Authorization": `VoalteSession ${session_token}`,
      },
    },
  );

  const response = await fetch(request);

  if (!response.ok) {
    throw new Error(`bad request: ${response.statusText}`);
  }

  return await response.json();
}

// using the session_token return all users session tokens
async function getUserSessionByIdJSON(
  user_id: number,
  session_token: string,
) {
  const request = new Request(
    `https://${VOALTE_DOMAIN}/rest/v2/users/${user_id}/sessions`,
    {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "Authorization": `VoalteSession ${session_token}`,
      },
    },
  );
  const response = await fetch(request);

  if (!response.ok) {
    throw new Error(`bad request: ${response.statusText}`);
  }

  return await response.json();
}

async function getProviderRolesNamedArray(
  session_token: string,
): Promise<Array<string>> {
  const request = new Request(
    `https://${VOALTE_DOMAIN}/rest/v2/roles/group/1124/role`,
    {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "Authorization": `VoalteSession ${session_token}`,
      },
    },
  );
  const response = await fetch(request);

  if (!response.ok) {
    throw new Error("bad request for provider roles");
  }

  const jsony = await response.json() as Array<any>;

  return jsony.map((role) => role.name).sort();
}

export async function createVoalteAllUsersJSON(session_token: string) {
  console.log("Starting call to get all Voalte users...");
  const all_users_json = await getAllUsersJSON(session_token);

  await Deno.writeTextFile(
    `voalte-all-users.json`,
    JSON.stringify(all_users_json),
  );

  console.log("voalte-all-users.json generated...");

  console.log("Completed...");
}

export async function createVoalteAllSessionsJSON(session_token: string) {
  let all_users_raw = Deno.readTextFileSync("voalte-all-users.json");

  if (!all_users_raw) {
    throw new Error("missing voalte-all-users.json file");
  }

  console.log("Starting voalte-all-user-sessions.json generation...");

  const all_users_json = JSON.parse(all_users_raw);

  const results = [];

  console.log("Starting calls to get all VoalteMe user sessions...");

  // pull down all provider roles
  const providerRoles = await getProviderRolesNamedArray(session_token);

  for (const user of all_users_json) {
    if (!user.client_type_access.includes("voalte_me")) {
      continue;
    }

    const httpResponse = await getUserSessionByIdJSON(
      user.id,
      session_token,
    );

    const filteredResponse = httpResponse.filter(
      (item: any) => item.client_type === "voalte_me",
    );

    const defaultRole = user.assignments.find((assign: { default: boolean }) =>
      assign.default
    )
      .role.name;

    results.push({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      default_role: defaultRole,
      provider: providerRoles.includes(defaultRole),
      voalte_sessions: filteredResponse,
    });
  }

  await Deno.writeTextFile(
    `voalte-all-users-sessions.json`,
    JSON.stringify(results),
  );

  console.log("voalte-all-users-sessions.json generated...");

  console.log("Completed...");
}

// using the voalte-all-sessions.json file create an excel report
export async function createVolateMeSessionExcelFromJSON() {
  const raw = await Deno.readTextFile("voalte-all-users-sessions.json");

  if (!raw) {
    throw new Error("missing voalte-all-users-sessions.json file");
  }

  console.log("Starting voalte_sessions.xlsx generation...");

  const parsed = JSON.parse(raw);

  const formatedTimestamp = (inputDate: any) => {
    const d = new Date(inputDate);
    const date = d.toISOString().split("T")[0].replace(/-/g, "/");
    const time = d.toTimeString().split(" ")[0];
    return `${date} ${time}`;
  };

  const flattenArrayOfObjects = (array: any) => {
    return array.map((obj: any) => {
      const { voalte_sessions, ...rest } = obj;

      // Map over `voalte_sessions` array to rename `id` to `voalte_me_session_id`
      const flattenedSessions = voalte_sessions.map((session: any) => {
        const { id, time_start, last_activity_time, ...sessionRest } = session;

        const pstTimeActivity = formatedTimestamp(last_activity_time);

        const pstTimeStart = formatedTimestamp(time_start);

        const lastActivityDate = new Date(last_activity_time);
        const currentDate = new Date();
        // @ts-ignore this is fine
        const diffTime = currentDate - lastActivityDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return {
          ...sessionRest,
          time_start: pstTimeStart,
          last_activity_time_pst: pstTimeActivity,
          days_last_active: diffDays,
          voalte_me_session_id: id,
        };
      });

      // Return the flattened object
      return {
        ...rest,
        ...flattenedSessions[0],
      };
    });
  };

  const flattenedData = flattenArrayOfObjects(parsed);

  const worksheet = XLSX.utils.json_to_sheet(flattenedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Voalte Sessions");

  XLSX.writeFile(workbook, "voalte_sessions.xlsx", { compression: true });
  console.log("voalte_sessions.xlsx generated...");
}
