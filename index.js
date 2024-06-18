import puppeteer from "puppeteer";
import chalk from "chalk";
import querystring from "querystring";
import authConfig from "./auth/credentials.js";
import tapsConfig from "./config/config.js";
import fs from "fs";
import axios from "axios";

function Errors(text) {
  return chalk.red(text);
}

function Success(text) {
  return chalk.green(text);
}
function Good(text) {
  return chalk.blue(text)
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

// Defined user details
const queryid = authConfig.query_id;
const uid = authConfig.user_id;
const firstname = authConfig.first_name;
const lastname = authConfig.last_name;
const languagecode = authConfig.language_code;
const allowwtp = authConfig.allows_write_to_pm;
const authd = authConfig.auth_date;
const uhash = authConfig.hash;

(async () => {
  const browser = await puppeteer.launch({ args:[ "--disable-setuid-sandbox", "--no-sandbox", "--single-process", "--no-zygote",],  executablePath: process.env.NODE_ENV === "production" ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath(), headless: true });
  const page = await browser.newPage();

  const monitorRequests = async () => {
    return new Promise((resolve, reject) => {
      let accessTokenFound = false;

      page.on("response", async (response) => {
        const url = response.url();
        const status = response.status();
        const headers = response.headers();
        const data = await response.json().catch(() => null);

        if (data && data.access_token) {
          accessTokenFound = true;
          console.log("Access token found:", data.access_token);
          await browser.close();
          resolve(data.access_token);
        }

        if (
          status === 400 &&
          url === "https://api.tapswap.ai/api/account/login"
        ) {
          //console.log(`Response received: ${url}`);
          console.log(`Status: ${status}`);
          //console.log("Headers:", headers);
          if (data) {
            console.log(`❌ Error: ${Errors(data.message)} Check your credentials config`);
            console.log('Quitting the browser in 10 seconds...');
            await delay(10000); 
            await browser.close();
          }
        }
      });

      const url = `https://app.tapswap.club/?bot=app_bot_0#tgWebAppData=query_id%3D${queryid}%26user%3D%257B%2522id%2522%253A${uid}%252C%2522first_name%2522%253A%2522${firstname}%2522%252C%2522last_name%2522%253A%2522${lastname}%2522%252C%2522language_code%2522%253A%2522${languagecode}%2522%252C%2522allows_write_to_pm%2522%253A${allowwtp}%257D%26auth_date%3D${authd}%26hash%3D${uhash}&tgWebAppVersion=7.2&tgWebAppPlatform=android&tgWebAppThemeParams=%7B%22bg_color%22%3A%22%23ffffff%22%2C%22section_bg_color%22%3A%22%23ffffff%22%2C%22secondary_bg_color%22%3A%22%23f0f0f0%22%2C%22text_color%22%3A%22%23222222%22%2C%22hint_color%22%3A%22%23a8a8a8%22%2C%22link_color%22%3A%22%232678b6%22%2C%22button_color%22%3A%22%2350a8eb%22%2C%22button_text_color%22%3A%22%23ffffff%22%2C%22header_bg_color%22%3A%22%23527da3%22%2C%22accent_text_color%22%3A%22%231c93e3%22%2C%22section_header_text_color%22%3A%22%233a95d5%22%2C%22subtitle_text_color%22%3A%22%2382868a%22%2C%22destructive_text_color%22%3A%22%23cc2929%22%7D`;
      //console.log(url);

      page.goto(url).catch((error) => reject(error));
    });
  };

  try {
    const accessToken = await monitorRequests();
    console.log("Access token captured:", accessToken);
    await sendTapsPeriodically(accessToken);
    await activateBoostsPeriodically(accessToken);
  } catch (error) {
    console.error("Error monitoring requests:", error);
  }
})();

function generateContentId() {
  const date = new Date();
  const timex = Math.floor(date.getTime());

  let result = timex * authConfig.user_id;
  result = result * authConfig.user_id;
  result = result / authConfig.user_id;
  result = result % authConfig.user_id;
  result = result % authConfig.user_id;
  return parseInt(result);
}

console.log(
  `${Good('==>')} | Successfully Generated | Content-Id: |`,
  generateContentId()
);

async function sendTaps(accessToken, boostActive) {
  const timex = Math.floor(new Date().getTime());
  const contentId = generateContentId();

  const body = {
    taps: boostActive ? 100 : 2,
    time: timex,
  };
  //console.log(body);
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
  const boostBody = { type: boostType };

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
    const response = await axios.post(ApplyBoostEndpoint, boostBody, {
      headers,
    });

    if (response.status >= 200 && response.status < 400) {
      console.log(
        `${formattedTime} ==> | ${Success("Success")} | ${boostType.charAt(0).toUpperCase() + boostType.slice(1)
        } Boost Activated Successfully ✔️`
      );
      let boostActive = true;
      const endTime = Date.now() + 22000;

      while (Date.now() < endTime) {
        await sendTaps(accessToken, boostActive);
        await delay(1000);
      }

      boostActive = false;
    } else {
      console.error(
        `${formattedTime} ==> | ${Errors("Error ⚠️")} | Failed To Activate ${boostType.charAt(0).toUpperCase() + boostType.slice(1)
        } Boost ❌`,
        response.data
      );
    }

    console.log(
      `${boostType.charAt(0).toUpperCase() + boostType.slice(1)
      } Boost Response:`,
      response.data
    );
  } catch (error) {
    console.error(
      "Error applying boost:",
      error.response ? error.response.data : error.message
    );
  }
}

async function activateBoostsPeriodically(accessToken, boost) {
  const boostInterval = tapsConfig.boostInterval;

  while (boost.cnt > 0) {
    await applyBoost(accessToken, boost.type);
    boost.cnt -= 1;

    if (boost.cnt > 0) {
      await delay(boostInterval);
    }
  }
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
