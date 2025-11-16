const AWS = require('aws-sdk');
var nodemailer = require('nodemailer');
require('dotenv').config({ path: '../config/config.env' });
const XMLHttpRequest = require('xhr2');

let sendMail = async (emailContent, recipientEmail, EmailSubject) => {
  // config setup.
  const AWS_SES = new AWS.SES({
    credentials: {
      accessKeyId: process.env.AWS_AccessKeySES || 'AKIASAL3MHFLJXFSBGI2',
      secretAccessKey:
        process.env.AWS_SecretAccessKeySES ||
        'BIyeuWNhqK8yM2HuaY3xXwJXuOrg1OYki9pIGJJnCU8P',
    },
    region: process.env.AWS_region || 'ap-south-1',
  });
  const params = {
    Destination: { ToAddresses: recipientEmail },
    Message: {
      Body: { Html: { Data: emailContent } },
      Subject: { Data: EmailSubject },
    },
    Source: process.env.AWS_SESMailId,
  };
  return await AWS_SES.sendEmail(params).promise();
};

let sendEmail_NETCORE = async (
  recipientEmail,
  mailTemplate,
  ccRecipientEmail = ''
) => {
  let transporter = nodemailer.createTransport({
    host: process.env.NETCORE_HOST,
    port: process.env.NETCORE_PORT,
    secure: true, // true for 465, false for other ports 587 //443
    auth: {
      user: process.env.NETCORE_USERNAME,
      pass: process.env.NETCORE_PASSWORD,
    },
  });
  // send mail with defined transport object
  let response = await transporter.sendMail({
    from: 'contact@mamypoko.co.in',
    to: recipientEmail,
    cc: ccRecipientEmail,
    subject: mailTemplate.subject,
    text: mailTemplate.text,
    html: mailTemplate.html,
  });
  return true;
};

const sendNetcoreMail = (data) => {
  try {
    let xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.addEventListener('readystatechange', function () {
      if (this.readyState === this.DONE) {
        console.log(this.responseText);
      }
    });

    xhr.open('POST', 'https://emailapi.netcorecloud.net/v5/mail/send');
    xhr.setRequestHeader('api_key', process.env.NETCORE_API_KEY);
    xhr.setRequestHeader('content-type', 'application/json');
    xhr.send(JSON.stringify(data));

    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
};

let sendEmail = async (recipientEmail, mailTemplate, ccRecipientEmail = '') => {
  let transporter = nodemailer.createTransport({
    host: 'email-smtp.ap-south-1.amazonaws.com',
    port: 465,
    secure: true, // true for 465, false for other ports 587 //443
    auth: {
      user: process.env.AWS_AccessKeySES || 'AKIASAL3MHFLJXFSBGI2',
      pass:
        process.env.AWS_SecretAccessKeySES ||
        'BIyeuWNhqK8yM2HuaY3xXwJXuOrg1OYki9pIGJJnCU8P',
    },
  });
  // send mail with defined transport object
  let response = await transporter.sendMail({
    from: 'contact@mamypoko.co.in',
    to: recipientEmail,
    cc: ccRecipientEmail,
    subject: mailTemplate.subject,
    text: mailTemplate.text,
    html: mailTemplate.html,
  });
  return true;
};

module.exports = { sendMail, sendEmail, sendNetcoreMail };
