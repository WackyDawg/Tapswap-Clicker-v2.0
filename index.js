import puppeteer from "puppeteer";
import chalk from "chalk";
import authConfig from "./auth/credentials.js";
import tapsConfig from "./config/config.js";
import axios from "axios";

function Errors(text) {
  return chalk.red(text);
}

function Success(text) {
  return chalk.green(text);
}

function Good(text) {
  return chalk.blue(text);
}

const SendTapsEndpoint = "https://api.tapswap.ai/api/player/submit_taps";
const ApplyBoostEndpoint = "https://api.tapswap.ai/api/player/apply_boost";

function getFormattedTime() {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  });
}

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

const { query_id, user_id, first_name, last_name, username, language_code, allows_write_to_pm, auth_date, hash, tgWebAppVersion, tgWebAppPlatform, tgWebAppThemeParams } = authConfig;

const url1 = `https://app.tapswap.club/?bot=app_bot_0#tgWebAppData=query_id%3D${query_id}%26user%3D%257B%2522id%2522%253A${user_id}%252C%2522first_name%2522%253A%2522${encodeURIComponent(first_name)}%2522%252C%2522last_name%2522%253A%2522${encodeURIComponent(last_name)}%2522%252C%2522language_code%2522%253A%2522${language_code}%2522%252C%2522allows_write_to_pm%2522%253A${allows_write_to_pm}%257D%26auth_date%3D${auth_date}%26hash%3D${hash}&tgWebAppVersion=${tgWebAppVersion}&tgWebAppPlatform=${tgWebAppPlatform}&${encodeURIComponent(JSON.stringify(tgWebAppThemeParams))}`;

const url2 = `https://app.tapswap.club/?bot=app_bot_0#tgWebAppData=query_id%3D${query_id}%26user%3D%257B%2522id%2522%253A${user_id}%252C%2522first_name%2522%253A%2522${encodeURIComponent(first_name)}%2522%252C%2522last_name%2522%253A%2522${encodeURIComponent(last_name)}%2522%252C%2522username%2522%253A%2522${encodeURIComponent(username)}%2522%252C%2522language_code%2522%253A%2522${language_code}%2522%252C%2522allows_write_to_pm%2522%253A${allows_write_to_pm}%257D%26auth_date%3D${auth_date}%26hash%3D${hash}&tgWebAppVersion=${tgWebAppVersion}&tgWebAppPlatform=${tgWebAppPlatform}&${encodeURIComponent(JSON.stringify(tgWebAppThemeParams))}`;

(async () => {
  const browser = await puppeteer.launch({
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
      "--no-zygote",
    ],
    executablePath:
      process.env.NODE_ENV === "production"
        ? process.env.PUPPETEER_EXECUTABLE_PATH
        : puppeteer.executablePath(),
    headless: true,
  });
  const page = await browser.newPage();

  const monitorRequests = async () => {
    return new Promise((resolve, reject) => {
      page.on("response", async (response) => {
        const data = await response.json().catch(() => null);

        if (data && data.access_token) {
          console.log("Access token found:", data.access_token);
          await browser.close();
          resolve(data.access_token);
        }

        if (
          response.status() === 400 &&
          response.url() === "https://api.tapswap.ai/api/account/login"
        ) {
          console.log(`Status: ${response.status}`);
          if (data) {
            console.log(
              `❌ Error: ${Errors(data.message)} Check your credentials config`
            );
            console.log("Quitting the browser in 10 seconds...");
            await delay(10000);
            await browser.close();
          }
        }
      });

      const selectedUrl = username ? url2 : url1;
      page.goto(selectedUrl).catch((error) => reject(error));
    });
  };

  try {
    const accessToken = await monitorRequests();
    console.log("Access token captured:", accessToken);
    await sendTapsPeriodically(accessToken);
    await activateBoostsPeriodically(accessToken, tapsConfig.boost);
  } catch (error) {
    console.error("Error monitoring requests:", error);
  }
})();

function generateContentId() {
  const date = new Date();
  const timex = Math.floor(date.getTime());

  let result = timex * user_id;
  result = result * user_id;
  result = result / user_id;
  result = result % user_id;
  result = result % user_id;
  return parseInt(result);
}

console.log(`${Good('==>')} | Successfully Generated | Content-Id: |`, generateContentId());

async function sendTaps(accessToken, boostActive) {
  const timex = Math.floor(new Date().getTime());
  const contentId = generateContentId();

  const body = {
    taps: boostActive ? 100 : 2,
    time: timex,
  };

  const headers = {
    Host: "api.tapswap.ai",
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    Referer: "https://app.tapswap.club/",
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "x-app": "tapswap_server",
    "x-bot": "no",
    "x-cv": "622",
    "Content-Id": `${contentId}`,
    Origin: "https://app.tapswap.club",
    Connection: "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
    Priority: "u=4",
  };

  try {
    const response = await axios.post(SendTapsEndpoint, body, { headers });
    const formattedTime = getFormattedTime();
    if (response.status >= 200 && response.status < 400) {
      console.log(
        `${formattedTime} ${Good('==>')} | ${Success(
          "Success"
        )} | Taps Sent Successfully ✔️`
      );
    } else {
      console.error(
        `${formattedTime} ${Errors('==>')} | ${Errors("Error ⚠️")} | Failed to Send Taps ❌`,
        response.data
      );
    }
  } catch (error) {
    console.error(
      "Error sending taps:",
      error.response ? error.response.data : error.message
    );
  }
}

async function applyBoost(accessToken, boostType) {
  const boostBody1 = { type: "energy" };
  const boostBody2 = { type: "turbo" };

  const headers = {
    Host: "api.tapswap.ai",
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    Referer: "https://app.tapswap.club/",
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "x-app": "tapswap_server",
    "x-bot": "no",
    "x-cv": "610",
    Origin: "https://app.tapswap.club",
    Connection: "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
    Priority: "u=1",
  };

  try {
    const formattedTime = getFormattedTime();

    const response1 = await axios.post(ApplyBoostEndpoint, boostBody1, { headers });
    if (response1.status >= 200 && response1.status < 400) {
      console.log(`${formattedTime} ==> | ${Success("Success")} | Energy Boost Activated Successfully ✔️`);
    } else {
      console.error(`${formattedTime} ==> | ${Errors("Error ⚠️")} | Failed to Activate Energy Boost ❌`, response1.data);
      return;
    }

    const response2 = await axios.post(ApplyBoostEndpoint, boostBody2, { headers });
    if (response2.status >= 200 && response2.status < 400) {
      console.log(`${formattedTime} ==> | ${Success("Success")} | Turbo Boost Activated Successfully ✔️`);
    } else {
      console.error(`${formattedTime} ==> | ${Errors("Error ⚠️")} | Failed to Activate Turbo Boost ❌`, response2.data);
      return;
    }

    let boostActive = true;
    const endTime = Date.now() + 22000; 

    while (Date.now() < endTime) {
      await sendTaps(accessToken, boostActive);
      await delay(1000); 
    }

    boostActive = false;

  } catch (error) {
    console.error("Error applying boost:", error.response ? error.response.data : error.message);
  }
}


async function activateBoostsPeriodically(accessToken, boost) {
  const boostInterval = tapsConfig.boostInterval;

  // Apply boosts immediately upon script launch
  await applyBoost(accessToken);

  let boostCount = 1;
  console.log(`Boost ${boostCount} applied successfully.`);

  while (boostCount < 3) {
    console.log(`Waiting for ${boostInterval / 1000} seconds before applying the next boost...`);
    await delay(boostInterval);
    await applyBoost(accessToken);
    boostCount += 1;
    console.log(`Boost ${boostCount} applied successfully.`);
  }

  console.log('All boosts applied successfully.');
}


async function sendTapsPeriodically(accessToken) {
  const cycleDuration = parseInt(tapsConfig.cycleDuration) * 1000;
  const numberOfTaps = parseInt(tapsConfig.numberOfTaps);

  try {
    while (true) {
      await sendTaps(accessToken, false);
      await delay(cycleDuration);
    }
  } catch (error) {
    console.error(
      "Error in sendTapsPeriodically:",
      error.response ? error.response.data : error.message
    );
  }
}
