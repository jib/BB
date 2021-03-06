
import BleManager from "react-native-ble-manager";
import BLEIDs from "./BLEIDs";
import { bin } from "charenc";
import StateBuilder from "./StateBuilder";
exports.createMediaState = async function (peripheral) {
	try {
		var mediaState = StateBuilder.blankMediaState();
		mediaState.peripheral = peripheral;
		mediaState = BLEIDs.BLELogger(mediaState, "BLE: Getting BLE Data for " + peripheral.name, false);
		return await this.refreshMediaState(mediaState);
	}
	catch (error) {
		console.log("BLE: " + BLEIDs.fixErrorMessage(error));
	}
};

exports.refreshMediaState = async function (mediaState) {

	if (mediaState.peripheral) {
		try {
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: Connecting MediaState: " + mediaState.peripheral.id, false);

			await BleManager.connect(mediaState.peripheral.id);
			await BleManager.retrieveServices(mediaState.peripheral.id);

			mediaState = await this.readTrack(mediaState, "Audio");
			mediaState = await this.readTrack(mediaState, "Video");
			mediaState = await this.refreshTrackList(mediaState, "Audio");
			mediaState = await this.refreshTrackList(mediaState, "Video");
			mediaState = await this.readVolume(mediaState);
			mediaState = await this.readBattery(mediaState);
			mediaState = await this.readAudioMaster(mediaState);
			mediaState = await this.readAppCommand(mediaState, "APKVersion");
			mediaState = await this.readAppCommand(mediaState, "APKUpdateDate");

			mediaState = BLEIDs.BLELogger(mediaState, "BLE: RefreshMediaState Complete: ", false);
			return mediaState;
		}
		catch (error) {
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: Refresh Media Error: " + error, true);
			return mediaState;
		}
	}
	else {
		return mediaState;
	}
};

exports.refreshDevices = async function (mediaState) {
	mediaState = await this.readTrack(mediaState, "Device");
	mediaState = await this.loadDevices(mediaState);
	return mediaState;
};

exports.loadDevices = async function (mediaState) {

	if (mediaState.peripheral) {

		try {
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: Load Devices request scan  ", false);

			await BleManager.write(mediaState.peripheral.id,
				BLEIDs.BTDeviceService,
				BLEIDs.BTDeviceInfoCharacteristic,
				[1]);
		}
		catch (error) {
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: Load Devices " + error, true);
		}

		var devices = [];
		try {
			for (var n = 1; n <= mediaState.device.maxDevice; n++) {

				var readData = await BleManager.read(
					mediaState.peripheral.id,
					BLEIDs.BTDeviceService,
					BLEIDs.BTDeviceInfoCharacteristic);

				var deviceInfo = "";
				if (readData.length > 3) {
					var deviceNo = readData[0];
					//var deviceMax = readData[1];
					var deviceStatus = readData[2];
					var isPaired;
					var deviceLabel;
					for (var i = 3; i < readData.length; i++) {
						deviceInfo += String.fromCharCode(readData[i]);
					}
					if (deviceStatus == 80) {
						deviceLabel = deviceInfo + " (Paired)";
						isPaired = true;
					} else {
						deviceLabel = deviceInfo;
						isPaired = false;
					}
				}
				if (deviceInfo && 0 != deviceInfo.length) {
					devices[deviceNo] = {
						deviceNo: deviceNo,
						deviceInfo: deviceInfo,
						deviceLabel: deviceLabel,
						isPaired: isPaired
					};

					mediaState = BLEIDs.BLELogger(mediaState, "BLE: Load Devices: " + devices.length + " Added", false);
					mediaState.device.devices = devices;
					mediaState = BLEIDs.BLELogger(mediaState, "BLE: Load Devices: " + JSON.stringify(devices) + " Added", false);

					return mediaState;
				}
			}
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: Load Devices found devices: " + JSON.stringify(devices), false);
		}
		catch (error) {
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: Load Devices Error: " + error, true);
		}
		return mediaState;
	}
	else
		return mediaState;
};

exports.readAppCommand = async function (mediaState, dataType) {

	var service = "";
	var channelCharacteristic = "";

	if (mediaState.peripheral) {
		if (dataType == "APKVersion") {
			service = BLEIDs.AppCommandsService;
			channelCharacteristic = BLEIDs.AppCommandsAPKVersionCharacteristic;
		}
		else if (dataType == "APKUpdateDate") {
			service = BLEIDs.AppCommandsService;
			channelCharacteristic = BLEIDs.AppCommandsAPKUpdateDateCharacteristic;
		}

		if (mediaState.peripheral) {
			try {

				var readData = await BleManager.read(mediaState.peripheral.id,
					service,
					channelCharacteristic);

				if (readData) {
					var charactersticValue = "";

					for (var i = 0; i < readData.length; i++) {
						charactersticValue += String.fromCharCode(readData[i]);
					}

					if (dataType == "APKVersion") {
						mediaState.APKVersion = charactersticValue;
					}
					else if (dataType == "APKUpdateDate") {
						charactersticValue = charactersticValue.slice(0, 20); // android bug
						mediaState.APKUpdateDate = charactersticValue;
					}

					mediaState = BLEIDs.BLELogger(mediaState, "BLE: Read " + dataType + "Value: " + charactersticValue, false);

				}
				else
					mediaState = BLEIDs.BLELogger(mediaState, "BLE: Read" + dataType + "returned Null", true);
			}
			catch (error) {
				mediaState = BLEIDs.BLELogger(mediaState, "BLE: " + dataType + "Error: " + error, true);
			}
			return mediaState;
		}
		else
			return mediaState;
	}
};

exports.readTrack = async function (mediaState, mediaType) {

	var service = "";
	var channelCharacteristic = "";

	if (mediaState.peripheral) {
		if (mediaType == "Audio") {
			service = BLEIDs.AudioService;
			channelCharacteristic = BLEIDs.AudioChannelCharacteristic;
		}
		else if (mediaType == "Device") {
			service = BLEIDs.BTDeviceService;
			channelCharacteristic = BLEIDs.BTDeviceSelectCharacteristic;
		}
		else {
			service = BLEIDs.VideoService;
			channelCharacteristic = BLEIDs.VideoChannelCharacteristic;
		}

		if (mediaState.peripheral) {
			try {

				var readData = await BleManager.read(mediaState.peripheral.id,
					service,
					channelCharacteristic);

				if (readData) {
					mediaState = BLEIDs.BLELogger(mediaState, "BLE: Read " + mediaType + "Track: Selected: " + readData[1] + " Max: " + readData[0], false);

					if (mediaType == "Audio") {
						mediaState.audio.channelNo = readData[1];
						mediaState.audio.maxChannel = readData[0];
					}
					else if (mediaType == "Device") {
						mediaState.device.channelNo = readData[1];
						mediaState.device.maxChannel = readData[0];
					}
					else {
						mediaState.video.channelNo = readData[1];
						mediaState.video.maxChannel = readData[0];
					}
				}
				else
					mediaState = BLEIDs.BLELogger(mediaState, "BLE: Read " + mediaType + ": returned Null", true);

			}
			catch (error) {
				mediaState = BLEIDs.BLELogger(mediaState, "BLE: " + mediaType + " read track error: " + error, true);
			}
			return mediaState;
		}
		else
			return mediaState;
	}
};

exports.refreshTrackList = async function (mediaState, mediaType) {

	var service = "";
	var infoCharacteristic = "";
	var maxChannel = 0;

	if (mediaState.peripheral) {
		if (mediaType == "Audio") {
			service = BLEIDs.AudioService;
			infoCharacteristic = BLEIDs.AudioInfoCharacteristic;
			maxChannel = mediaState.audio.maxChannel;
		}
		else {
			service = BLEIDs.VideoService;
			infoCharacteristic = BLEIDs.VideoInfoCharacteristic;
			maxChannel = mediaState.video.maxChannel;
		}

		var channels = [];

		try {
			for (var n = 1; n <= maxChannel; n++) {

				var readData = await BleManager.read(mediaState.peripheral.id, service, infoCharacteristic);
				var channelNo = readData[0];
				var channelInfo = "";
				for (var i = 1; i < readData.length; i++) {
					channelInfo += String.fromCharCode(readData[i]);
				}
				if (channelInfo && 0 != channelInfo.length) {
					channels[channelNo] = { channelNo: channelNo, channelInfo: channelInfo };
				}
			}
			if (mediaType == "Audio") {
				mediaState.audio.channels = channels;
			}
			else {
				mediaState.video.channels = channels;
			}
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: " + channels.length + " " + mediaType + " Added: ", false);
			return mediaState;
		}
		catch (error) {
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: " + mediaType + " Error: " + error, false);
			return mediaState;
		}
	}
	else
		return mediaState;
};

exports.setTrack = async function (mediaState, mediaType, idx) {

	var service = "";
	var channelCharacteristic = "";
	var channelNo;
	var trackNo = parseInt(idx);

	if (mediaType == "Audio") {
		service = BLEIDs.AudioService;
		channelCharacteristic = BLEIDs.AudioChannelCharacteristic;
		channelNo = [mediaState.audio.channels[trackNo].channelNo];
	}
	else if (mediaType == "Device") {
		service = BLEIDs.BTDeviceService;
		channelCharacteristic = BLEIDs.BTDeviceSelectCharacteristic;
		channelNo = bin.stringToBytes(mediaState.device.devices[trackNo].deviceInfo);
	}
	else {
		service = BLEIDs.VideoService;
		channelCharacteristic = BLEIDs.VideoChannelCharacteristic;
		channelNo = [mediaState.video.channels[trackNo].channelNo];
	}

	mediaState = BLEIDs.BLELogger(mediaState, "BLE: " + mediaType + " SetTrack submitted value: " + channelNo, false);

	if (mediaState.peripheral) {
		try {
			await BleManager.write(mediaState.peripheral.id,
				service,
				channelCharacteristic,
				channelNo);

			mediaState = BLEIDs.BLELogger(mediaState, "BLE: " + mediaType + " Update: " + channelNo, false);

			mediaState = await this.readTrack(mediaState, mediaType);
		}
		catch (error) {
			mediaState.peripheral.connected = false;
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: " + mediaType + " " + error, true);
		}
		return mediaState;
	}
	else
		return mediaState;
};

exports.onUpdateVolume = async function (volume, mediaState) {
 
	mediaState = BLEIDs.BLELogger(mediaState, "BLE: Submitted Volume: " + volume, false);

	if (mediaState.peripheral) {
		try {
			await BleManager.write(mediaState.peripheral.id,
				BLEIDs.AudioService,
				BLEIDs.AudioVolumeCharacteristic,
				[volume]);

			var newMediaState = await this.readVolume(mediaState);

			return newMediaState;
		}
		catch (error) {
			mediaState.peripheral.connected = false;

			mediaState = BLEIDs.BLELogger(mediaState, "BLE: Update Volume Error: " + error, true);
			return mediaState;
		}
	}
	else
		return mediaState;
};

exports.readVolume = async function (mediaState) {

	if (mediaState.peripheral) {
		try {
			var readData = await BleManager.read(mediaState.peripheral.id, BLEIDs.AudioService, BLEIDs.AudioVolumeCharacteristic);
			if (readData) {

				mediaState = BLEIDs.BLELogger(mediaState, "BLE: Read Volume: " + readData[0], false);

				mediaState.audio.volume = readData[0];
			}
			else
				mediaState = BLEIDs.BLELogger(mediaState, "BLE: Read Volume:  returned Null", true);
		}
		catch (error) {
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: Read Volume Error: " + error, true);
		}
		return mediaState;
	}
	else
		return mediaState;
};

exports.onGTFO = async function (value, mediaState) {

	mediaState = BLEIDs.BLELogger(mediaState, "BLE: GTFO submitted value: " + value, false);

	if (mediaState.peripheral) {
		try {
			await BleManager.write(mediaState.peripheral.id,
				BLEIDs.AppCommandsService, BLEIDs.AppCommandsGTFOCharacteristic,
				[value]);

			return mediaState;
		}
		catch (error) {
			mediaState.peripheral.connected = false;
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: GTFO Error: " + error, true);
			return mediaState;
		}
	}
	else
		return mediaState;
};

exports.onEnableMaster = async function (value, mediaState) {

	var newMaster = value;
	mediaState = BLEIDs.BLELogger(mediaState, "BLE: Enable Master submitted value: " + newMaster, false);

	if (mediaState.peripheral) {
		try {
			await BleManager.write(mediaState.peripheral.id,
				BLEIDs.AudioSyncService, BLEIDs.AudioSyncRemoteCharacteristic,
				[newMaster]);

			var newMediaState = await this.readAudioMaster(mediaState);

			return newMediaState;
		}
		catch (error) {
			mediaState.peripheral.connected = false;
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: Enable Master Error: " + error, true);
			return mediaState;
		}
	}
	else
		return mediaState;
};


exports.readBattery = async function (mediaState) {

	if (mediaState.peripheral) {
		try {
			var readData = await BleManager.read(mediaState.peripheral.id, BLEIDs.BatteryService, BLEIDs.BatteryCharacteristic);
			if (readData) {
				mediaState = BLEIDs.BLELogger(mediaState, "BLE: Read Battery: " + readData[0], false);
				mediaState.battery = readData[0];
			}
			else
				mediaState = BLEIDs.BLELogger(mediaState, "BLE: Read Battery returned Null", true);
		}
		catch (error) {
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: Read Battery Error: " + error, true);
		}
		return mediaState;
	}
	else
		return mediaState;
};

exports.readAudioMaster = async function (mediaState) {

	if (mediaState.peripheral) {
		try {
			var readData = await BleManager.read(mediaState.peripheral.id, BLEIDs.AudioSyncService, BLEIDs.AudioSyncRemoteCharacteristic);

			if (readData) {
				mediaState = BLEIDs.BLELogger(mediaState, "BLE: Read Audio Master: " + readData[0], false);

				mediaState.audioMaster = readData[0];
			}
			else
				mediaState = BLEIDs.BLELogger(mediaState, "BLE: Read Audio Master: returned Null", true);
		}
		catch (error) {
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: Read audio Master: " + error, true);
		}
		return mediaState;
	}
	else
		return mediaState;
};

exports.readLocation = async function (mediaState) {

	if (mediaState.peripheral) {
		try {
			var readData = await BleManager.read(mediaState.peripheral.id, BLEIDs.locationService, BLEIDs.locationCharacteristic);

			if (readData) {
				if (readData.length > 4) {
					var lat;
					var lon; 
					var address;
					address = readData[2] + readData[3] * 256;
					lat = readData[5] + readData[6] * 256 + readData[7] * 65536 + readData[8] * 16777216;
					if (lat > Math.pow(2, 31)) {
						lat = -1 * (Math.pow(2, 32) - 1 - lat);
					}
					lon = readData[9] + readData[10] * 256 + readData[11] * 65536 + readData[12] * 16777216;
					if (lon > Math.pow(2, 31)) {
						lon = -1 * (Math.pow(2, 32) - 1 - lon);
					}

					if (lat != 0 && lon != 0) {
						// remove if it already exists.
						mediaState.locations = mediaState.locations.filter(item => {
							return item.address != address.toString();
						});


						var milliseconds = 60000 * (readData[16] + readData[15] * 256 + readData[14] * 65536 + readData[13] * 16777216);
						var locationDate = new Date(milliseconds).toUTCString();

						// avoid crap dates because of the bits that were sent in older versions of the boards.
						if(locationDate > new Date("January 1, 2099") || locationDate < new Date("January 1, 2000"))
							locationDate = null;

						var title = "";

						// if you have the boards JSON find the name.
						var board = mediaState.boards.filter((b) => {
							return b.address == address;
						});

						var boardID = "";
						if (board) {
							boardID = board[0].name;
							title = board[0].name;
						}
						else {
							title = address.toString();
						}

						// push the new one.
						mediaState.locations.push({
							title: title,
							latitude: lat / 1000000.0,
							longitude: lon / 1000000.0,
							address: address.toString(),
							boardId: boardID,
							dateTime: locationDate,
						});

						mediaState = BLEIDs.BLELogger(mediaState, "BLE: ReadLocation found new coordinates lat: " + lat + " lon: " + lon, false);

					}
				}
			}
			else {
				mediaState = BLEIDs.BLELogger(mediaState, "BLE: ReadLocation found no new coordinates", false);
			}

			return mediaState;
		}
		catch (error) {
			mediaState = BLEIDs.BLELogger(mediaState, "BLE: Read Location Error: " + error, true);
			return mediaState;
		}
	}
	else
		return mediaState;

};




