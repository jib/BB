const constants = require("./Constants");
const Storage = require("@google-cloud/storage");
const storage = Storage();
const google = require("googleapis");
const drive = google.drive("v2");
const bucket = storage.bucket("burner-board");
const ffmpegPath = require("ffmpeg-static").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);

var fileAttributes = {
	fileSize: 0,
	mimeType: "",
	title: "",
	songDuration: 0,
	speechCue: 0,
};

exports.addGDriveFile = async function (boardID, profileID, fileId, oauthToken, speechCue) {

	return new Promise((resolve, reject) => {

		var tempFileName = "";

		drive.files.get({
			fileId: fileId,
			"access_token": oauthToken,
		}, function (err, jsonContent) {

			if (err)
				return reject(err);
			else {
				fileAttributes = {
					fileSize: parseInt(jsonContent.fileSize),
					mimeType: jsonContent.mimeType,
					title: jsonContent.title,
					songDuration: 0,
					speechCue: "",
				};

				if (jsonContent.title.endsWith("m4a") || jsonContent.title.endsWith("mp3") || jsonContent.title.endsWith("mp4")) {
					checkForFileExists(boardID, profileID, jsonContent.title)
						.then(result => {
							if (result == true)
								throw new Error("the file " + fileAttributes.title + " already exists for board " + boardID + " in profile " + profileID);
							else {

								drive.files.get({
									fileId: fileId,
									"access_token": oauthToken,
									alt: "media"
								}, {
										encoding: null // Make sure we get the binary data
									}, function (err, content) {

										if (err)
											return reject(err);
										else {
											// now get the real file and save it.
											var filePath = "";
											if (boardID != null)
												filePath = constants.MUSIC_PATH + "/" + boardID + "/" + profileID + "/" + fileAttributes.title;
											else
												filePath = constants.MUSIC_PATH + "/global/" + profileID + "/" + fileAttributes.title;

											var file3 = bucket.file(filePath);
											var fileStream3 = file3.createWriteStream({
												metadata: {
													contentType: fileAttributes.mimeType,
												}
											});

											fileStream3.on("error", (err) => {
												return reject(err);
											});

											fileStream3.on("finish", () => {
												file3.makePublic();

												const DownloadDirectoryDS = require("./DownloadDirectoryDS");
												if (filePath.endsWith("mp3") || filePath.endsWith("m4a")) {

													var streamToBuffer = require("stream-to-buffer");
													var stream3 = file3.createReadStream();

													streamToBuffer(stream3, function (err, buffer) {
														var i = buffer.length;
														var mp3Duration = require("mp3-duration");
														mp3Duration(buffer, function (err, duration) {
															if (err)
																throw new Error(err);

															if (filePath.endsWith("mp3"))
																fileAttributes.songDuration = Math.floor(duration);
															else
																fileAttributes.songDuration = 0; // length wont be accurate.  0 should not hurt.  
															//It will just mean length changes on the server wont force refresh.

															DownloadDirectoryDS.addMedia(boardID,
																profileID,
																"audio",
																filePath,
																fileAttributes.fileSize,
																fileAttributes.songDuration,
																"")
																.then(result => {
																	return resolve(result);
																})
																.catch(function (err) {
																	return reject(err);
																});
														});
													});
												}
												else if (filePath.endsWith("mp4")) {

													DownloadDirectoryDS.addMedia(boardID,
														profileID,
														"video",
														filePath,
														fileAttributes.fileSize,
														0,
														"speechCue")
														.then(result => {
															return resolve(result);
														})
														.catch(function (err) {
															return reject(err);
														});
												}
											});
											fileStream3.end(content);
										}
									});
							}
						})
						.catch(function (err) {
							return reject(err);
						});
				}
				else {
					return reject(new Error("The file must have an mp3, m4a, or mp4 extension."));
				}
			}
		});
	});
};

exports.listProfileFiles = async function (boardID, profileID) {
	try {

		var result = await bucket.getFiles({
			autoPaginate: false,
			delimiter: "/",
			prefix: constants.MUSIC_PATH + "/" + boardID + "/" + profileID + "/"
		});

		return result[0].map(item => {
			return item.name;
		});
	}
	catch (error) {
		throw new Error(error);
	}
};

exports.copyProfileFiles = async function (boardID, profileID, cloneFromBoardID, cloneFromProfileID) {

	try {

		var replacementPath = "";
		var profilePath = "";

		if (boardID != null)
			replacementPath = constants.MUSIC_PATH + "/" + boardID + "/" + profileID + "/";
		else
			replacementPath = constants.MUSIC_PATH + "/global/" + profileID + "/";

		if (cloneFromBoardID != null)
			profilePath = constants.MUSIC_PATH + "/" + cloneFromBoardID + "/" + cloneFromProfileID + "/";
		else
			profilePath = constants.MUSIC_PATH + "/global/" + cloneFromProfileID + "/";

		var result = await bucket.getFiles({
			autoPaginate: false,
			delimiter: "/",
			prefix: profilePath,
		});

		return result[0].map(item => {
			item.copy(item.name.replace(profilePath, replacementPath));
			return item.name;
		});
	}
	catch (error) {
		throw new Error(error);
	}
};

exports.createRootBoardFolder = async function (boardID) {

	try {
		var result = await bucket.getFiles({
			autoPaginate: false,
			delimiter: "/",
			prefix: constants.MUSIC_PATH + "/template/default/"
		});

		for (var i = 0; i < result[0].length; i++) {
			result[0][i].copy(result[0][i].name.replace("template", boardID),
				function (err, copiedFile, apiResponse) {
					copiedFile.makePublic();
				});
		}

		return "Root Folder " + boardID + " created";
	}
	catch (error) {
		throw new Error(error);
	}
};

checkForFileExists = async function (boardID, profileID, fileName) {

	try {
		var profilePath = "";
		if (boardID != null)
			profilePath = constants.MUSIC_PATH + "/" + boardID + "/" + profileID + "/" + fileName;
		else
			profilePath = constants.MUSIC_PATH + "/global/" + profileID + "/" + fileName;

		var result = await bucket.getFiles({
			autoPaginate: false,
			delimiter: "/",
			prefix: profilePath
		});

		if (result[0].length > 0)
			return true;
		else
			return false;

	}
	catch (error) {
		throw new Error(error);
	}
};

exports.deleteMedia = async function (boardID, profileID, fileName) {

	try {

		var filePath = "";
		if (boardID != null)
			filePath = constants.MUSIC_PATH + "/" + boardID + "/" + profileID + "/" + fileName;
		else
			filePath = constants.MUSIC_PATH + "/global/" + profileID + "/" + fileName;

		await bucket
			.file(filePath)
			.delete();

		return "File " + filePath + " deleted.";
	}
	catch (error) {
		throw new Error(error);
	}
};

exports.deleteProfile = async function (boardID, profileID) {

	try {
		var filePath = "";

		if (boardID != null)
			filePath = constants.MUSIC_PATH + "/" + boardID + "/" + profileID;
		else
			filePath = constants.MUSIC_PATH + "/global/" + profileID;

		await bucket.deleteFiles({ prefix: filePath });
		return filePath + "* deleted";

	}
	catch (error) {
		throw new Error(error);
	}
};

exports.deleteBoard = async function (boardID) {
	try {
		await bucket.deleteFiles({ prefix: constants.MUSIC_PATH + "/" + boardID });
		return constants.MUSIC_PATH + "/" + boardID + "* deleted";
	}
	catch (error) {
		throw new Error(error);
	}
};

exports.convertToM4A = async function (boardID, profileID, fileName) {

	var duration = 0; // we can only get this via converting the file. No Metadata!!
	var filePath = "";
	if (boardID != null)
		filePath = constants.MUSIC_PATH + "/" + boardID + "/" + profileID + "/" + fileName;
	else
		filePath = constants.MUSIC_PATH + "/global/" + profileID + "/" + fileName;

	var file = bucket.file(filePath);
	var remoteReadStream = bucket.file(file.name).createReadStream();
	var remoteWriteStream = bucket.file(file.name.replace(".mp3", ".m4a"))
		.createWriteStream({
			metadata: {
				contentType: "audio/mp4",
			}
		});
 
	return new Promise((resolve, reject) => {
		ffmpeg()
			.input(remoteReadStream)
			.format("mp4")
			.outputOptions("-movflags frag_keyframe+empty_moov") // Not sure what this does, but it works.
			.audioCodec("aac")
			.audioBitrate(128)
			.outputOptions("-y")
			.on("start", (cmdLine) => {
				console.log("Started ffmpeg with command:", cmdLine);
			})
			.on("progress", (progress) => {
				console.log(`[ffmpeg] ${JSON.stringify(progress)}`);
				duration = progress.timemark;
			})
			.on("end", (data) => {
				console.log("Successfully re-encoded audio.");
				console.log(JSON.stringify(data));
				resolve(duration);
			})
			.on("error", (err, stdout, stderr) => {
				console.error("An error occured during encoding", err.message);
				console.error("stdout:", stdout);
				console.error("stderr:", stderr);
				reject(err);
			})
			.pipe(remoteWriteStream, { end: true }); // end: true, emit end event when readable stream ends
	});
};
 