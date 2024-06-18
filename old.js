import https from "https";
import chalk from "chalk";
import querystring from "querystring";
import authConfig from "./auth/credentials.js";
import tapsConfig from "./config/config.js";
import fs from "fs";
import axios from 'axios';
import { JSDOM } from 'jsdom';


function Errors(text) {
  return chalk.red(text);
}

function Success(text) {
  return chalk.green(text);
}

const LoginEndpoint = "https://api.tapswap.ai/api/account/login";
const SendTapsEndpoint = "https://api.tapswap.ai/api/player/submit_taps";
const ApplyBoostEndpoint = "https://api.tapswap.ai/api/player/apply_boost";

function getFormattedTime() {
  return new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true,
  });
}

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

function extractChqResult(chq) {
  let len = chq.length;
  let bytesArray = new Uint8Array(len / 2);
  let x = 157;

  for (let i = 0; i < len; i += 2) {
      bytesArray[i / 2] = parseInt(chq.substring(i, i + 2), 16);
  }

  let xored = new Uint8Array(bytesArray.length);
  for (let i = 0; i < bytesArray.length; i++) {
      xored[i] = bytesArray[i] ^ x;
  }

  let decoded = new TextDecoder().decode(xored);
  let jsCode = decoded.split('try {eval("document.getElementById");} catch {return 0xC0FEBABE;}')[1].split('})')[0].trim();
  return runCodeAndCalculateResult(jsCode);
}

function extractCodesFromHtml(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const divElements = document.querySelectorAll('div');
  let codes = {};

  divElements.forEach(div => {
      if (div.id && div.getAttribute('_d_')) {
          codes[div.id] = div.getAttribute('_d_');
      }
  });

  return codes;
}

function runCodeAndCalculateResult(code) {
  let rtElementContent = code.split('rt["inner" + "HTM" + "L"] = ')[1].split('\n')[0];
  let codes = extractCodesFromHtml(rtElementContent);

  let va, vb;
  for (let [k, v] of Object.entries(codes)) {
      if (code.split('\n')[5].includes(k)) {
          va = v;
      }
      if (code.split('\n')[6].includes(k)) {
          vb = v;
      }
  }

  let codeToExecute = code.split('return ')[1].split(';')[0];
  codeToExecute = codeToExecute.replace('va', va).replace('vb', vb);
  // Note: Using eval can be risky. Consider refactoring this if possible.
  return eval(codeToExecute);
}

async function authenticate() {
  const user = {
    id: authConfig.user_id,
    first_name: authConfig.first_name,
    last_name: authConfig.last_name,
    username: authConfig.username,
    language_code: authConfig.language_code,
    allows_write_to_pm: authConfig.allows_write_to_pm,
  };

  const init_data = querystring.stringify({
    query_id: authConfig.query_id,
    user: JSON.stringify(user),
    auth_date: authConfig.auth_date,
    hash: authConfig.hash,
  });

  const data = JSON.stringify({
    init_data: init_data,
    referrer: "",
    bot_key: "app_bot_0",
  });

  const headers = {
    'Host': 'api.tapswap.ai',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Referer': 'https://app.tapswap.club/',
    'Content-Type': 'application/json',
    'x-app': 'tapswap_server',
    'x-bot': 'no',
    'x-cv': '622',
    'Origin': 'https://app.tapswap.club',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'Priority': 'u=4'
  }

  try {
    const response = await axios.post(LoginEndpoint, data, { headers });
    const formattedTime = getFormattedTime();
    if (response.status >= 200 && response.status < 400) {
      if (response.data && response.data.chq) {
        const chq = response.data.chq;
        const decodedResult = extractChqResult(chq);
        console.log(Success('Decoded CHQ Result:'), decodedResult);

        const secondData = JSON.stringify({
          init_data: init_data,
          referrer: "",
          bot_key: "app_bot_0",
          chr: decodedResult 
        });

        const secondResponse = await axios.post(LoginEndpoint, secondData, { headers });
        //console.log(Success('Second Login Response:'), secondResponse.data);

        if (secondResponse.statusCode >= 200 && secondResponse.statusCode < 400) {
          console.log(`${formattedTime} ==> | ${Success("Success")} | Authenticated Successfully ✔️`);
        } else {
          console.error(`${formattedTime} ==> | ${Errors("Error ⚠️")} | Unauthorized ❌`);
        }
        const accessToken = secondResponse.data.access_token;

        if (accessToken) {
          const coinsPerCycle = parseInt(tapsConfig.coinsPerCycle);
          const cycleDuration = parseInt(tapsConfig.cycleDuration);
          const cyclesPerDay = Math.floor(86400 / cycleDuration);
          const totalCoinsPerDay = coinsPerCycle * cyclesPerDay;
          console.log(`Total Coins To Earn Per Day: ${totalCoinsPerDay}`);

          const responseData2 = secondResponse.data;
          if (responseData2.player && responseData2.player.boost) {
            const boosts = responseData2.player.boost;
            responseData2.player.boost1 = boosts[0];
            responseData2.player.boost2 = boosts[1];

            console.log('Boost 1:', responseData2.player.boost1);
            console.log('Boost 2:', responseData2.player.boost2);
            
            // Check and apply boosts
            if (responseData2.player.boost1.cnt > 0) {
              activateBoostsPeriodically(accessToken, responseData2.player.boost1);
            }
            if (responseData2.player.boost2.cnt > 0) {
              activateBoostsPeriodically(accessToken, responseData2.player.boost2);
            }
          }

          sendTapsPeriodically(accessToken);
        }
      } else {
        console.log(Errors('CHQ field not found in the response:'), response.data);
      }
    } else {
      console.error(`${formattedTime} ==> | ${Errors("Error ⚠️")} | Unauthorized ❌`);
    }
  } catch (error) {
    console.error(Errors('Error:'), error);
  }
}

const date = new Date();
const timex = Math.floor(date.getTime());

let result = timex * authConfig.user_id;
result = result * authConfig.user_id;
result = result / authConfig.user_id;
result = result % authConfig.user_id;
result = result % authConfig.user_id;
const contentId = parseInt(result);

console.log("==> | Successfully Generated | Content-Id: |", contentId);

async function sendTaps(accessToken, boostActive) {
  const requestBody = {
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
    const response = await axios.post(SendTapsEndpoint, requestBody, { headers });
    const formattedTime = getFormattedTime();
    if (response.status >= 200 && response.status < 400) {
      console.log(`${formattedTime} ==> | ${Success("Success")} | Taps Sent Successfully ✔️`);
    } else {
      console.error(`${formattedTime} ==> | ${Errors("Error ⚠️")} | Failed to Send Taps ❌`);
    }
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
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
    const response = await axios.post(ApplyBoostEndpoint, boostBody, { headers });

    if (response.status >= 200 && response.status < 400) {
      console.log(`${formattedTime} ==> | ${Success("Success")} | ${boostType.charAt(0).toUpperCase() + boostType.slice(1)} Boost Activated Successfully ✔️`);
      // Start sending boosted taps 🗲
      let boostActive = true;
      const endTime = Date.now() + 22000; // 🗲 Boost duration of 22 seconds

      while (Date.now() < endTime) {
        await sendTaps(accessToken, boostActive);
        await delay(1000); // Send 🗲 boosted taps every second
      }

      boostActive = false;
    } else {
      console.error(`${formattedTime} ==> | ${Errors("Error ⚠️")} | Failed To Activate ${boostType.charAt(0).toUpperCase() + boostType.slice(1)} Boost ❌`);
    }

    console.log(`${boostType.charAt(0).toUpperCase() + boostType.slice(1)} Boost Response:`, response.data);
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
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
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}


authenticate();
