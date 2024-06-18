import url from "url";
import querystring from "querystring";
import fs from "fs";

const Url = "URL HERE!!";

const parsedUrl = url.parse(Url);
const queryParams = querystring.parse(parsedUrl.hash.slice(1));

const tgWebAppData = queryParams.tgWebAppData;
const decodedData = querystring.parse(tgWebAppData);

try {
  const user = JSON.parse(decodedData.user);

  const details = {
    query_id: decodedData.query_id,
    user_id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    language_code: user.language_code,
    allows_write_to_pm: user.allows_write_to_pm,
    auth_date: decodedData.auth_date,
    hash: decodedData.hash,
    tgWebAppVersion: queryParams.tgWebAppVersion,
    tgWebAppPlatform: queryParams.tgWebAppPlatform,
    tgWebAppThemeParams: JSON.parse(queryParams.tgWebAppThemeParams),
  };

  fs.writeFileSync("./auth/credentials.json", JSON.stringify(details, null, 2));

  console.log("Details saved to credentials.json");
} catch (error) {
  console.error("Error parsing JSON data:", error.message);
}
