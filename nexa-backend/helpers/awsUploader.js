var AWS = require('aws-sdk');
Fs = require('fs');
const path = require('path');

AWS.config.update({
  apiVersion: 'latest',
  region: 'us-west-1',
  s3BucketEndpoint: false,
  s3ForcePathStyle: true,
  accessKeyId: process.env.AWS_AccessKeyId,
  seccretAccessKey: process.env.AWS_SecretAccessKey,
});

awsUploader = async function (file) {
  var s3 = new AWS.S3();
  var myBucket = process.env.AWS_DraftBucket;
  var dataPath = file.path;
  var stream = Fs.createReadStream(dataPath);
  var newFileName = path.parse(file.originalname).name;
  newFileName = newFileName.replace(/ /g, '');

  var params = {
    Bucket: myBucket,
    Body: stream,
    Key: dataPath,
    ACL: 'public-read',
    ContentLength: stream.byteCount,
    ContentDisposition: 'inline',
    maxTries: 20,
    ContentType: file.mimetype,
  };
  const stored = await s3.upload(params).promise();
  // Fs.unlinkSync(file.path);
  return stored.Location;
};
awsUploaderMultiple = async function (files, childId, parentId, category) {
  var s3 = new AWS.S3();
  var myBucket = process.env.AWS_DraftBucket;
  let response = new Array();

  for (let file of files) {
    var dataPath = file.path;
    var name = file.originalname;
    var stream = Fs.createReadStream(dataPath);
    var newFileName = path.parse(file.originalname).name;
    newFileName = newFileName.replace(/ /g, '');

    var params = {
      Bucket: myBucket,
      Body: stream,
      Key: dataPath,
      ACL: 'public-read',
      ContentLength: stream.byteCount,
      maxTries: 20,
    };
    const stored = await s3.upload(params).promise();
    Fs.unlinkSync(file.path);
    response.push({
      file: stored.Location,
      fileName: name,
      childId,
      parentId,
      category,
      status: true,
    });
  }
  return response;
};

module.exports = { awsUploader, awsUploaderMultiple };
