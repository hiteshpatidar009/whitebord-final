const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();

const config = {
  user: "u958214831.Hardik",
  password: "Vz#!mY#+kC830@d4",
  host: "ftp.anirbansacademy.com",
  port: 21,
  localRoot: __dirname + "/dist", // React build folder
  remoteRoot: "/whiteboard/",             // <-- use dot to refer to your FTP login folder
  include: ["*", "**/*"],
  exclude: ["node_modules/**", "deploy.cjs"],
  passive: true,
};

ftpDeploy
  .deploy(config)
  .then(() => console.log("✅ Frontend uploaded successfully!"))
  .catch(err => console.error("❌ Deployment error:", err));
