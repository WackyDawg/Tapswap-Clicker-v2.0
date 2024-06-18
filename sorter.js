import url from "url";
import querystring from "querystring";
import fs from "fs"


const Url = "Input Url Here!!";

const parsedUrl = url.parse(Url);
const queryParams = querystring.parse(parsedUrl.hash.slice(1));

const tgWebAppData = queryParams.tgWebAppData;
const decodedData = querystring.parse(tgWebAppData);

const details = {
  query_id: decodedData.query_id,
  user_id: JSON.parse(decodedData.user).id,
  first_name: JSON.parse(decodedData.user).first_name,
  last_name: JSON.parse(decodedData.user).last_name,
  username: JSON.parse(decodedData.user).username,
  language_code: JSON.parse(decodedData.user).language_code,
  allows_write_to_pm: JSON.parse(decodedData.user).allows_write_to_pm,
  auth_date: decodedData.auth_date,
  hash: decodedData.hash,
};

fs.writeFileSync("./auth/credentials.json", JSON.stringify(details, null, 2));

console.log("Details saved to credentials.json");
