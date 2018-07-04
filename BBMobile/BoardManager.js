import React, {
	Component
} from "react";
import {
	StyleSheet,
	View,
	NativeEventEmitter,
	NativeModules,
	Platform,
	PermissionsAndroid,
	AppState,
	Text,
	ScrollView,
	ListView,
} from "react-native";
import BleManager from "react-native-ble-manager";
import BLEIDs from "./BLEIDs";
import FileSystemConfig from "./FileSystemConfig";
import BLEBoardData from "./BLEBoardData";
import MediaManagement from "./MediaManagement";
import AdminManagement from "./AdminManagement";
import Diagnostic from "./Diagnostic";
import Touchable from "react-native-platform-touchable";
import StateBuilder from "./StateBuilder";
import BBComAPIData from "./BBComAPIData";

const ds = new ListView.DataSource({
	rowHasChanged: (r1, r2) => r1 !== r2
});

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

//connection states.
const DISCONNECTED = "Disconnected";
const LOCATED = "Located";
const CONNECTED = "Connected";

// The Screens
const DISCOVER = "Discover";
const MEDIA_MANAGEMENT = "Media Management";
const ADMINISTRATION = "Administration";
const DIAGNOSTIC = "Diagnostic";

export default class BoardManager extends Component {
	constructor() {
		super();

		this.state = {
			scanning: false,
			peripherals: new Map(),
			appState: "",
			selectedPeripheral: StateBuilder.blankMediaState().peripheral,
			mediaState: StateBuilder.blankMediaState(),
			locationState: "",
			showScreen: MEDIA_MANAGEMENT,
			discoveryState: DISCONNECTED,
			automaticallyConnect: true,
			backgroundLoop: null,
			title: "Board Management",
			boardData: [],
			boardColor: "blue",
		};

		this.handleDiscoverPeripheral = this.handleDiscoverPeripheral.bind(this);
		this.handleStopScan = this.handleStopScan.bind(this);
		this.handleDisconnectedPeripheral = this.handleDisconnectedPeripheral.bind(this);
		this.handleAppStateChange = this.handleAppStateChange.bind(this);
		this.onUpdateVolume = this.onUpdateVolume.bind(this);
		this.onSelectAudioTrack = this.onSelectAudioTrack.bind(this);
		this.onSelectVideoTrack = this.onSelectVideoTrack.bind(this);
		this.onSelectDevice = this.onSelectDevice.bind(this);
		this.onRefreshDevices = this.onRefreshDevices.bind(this);
		this.onLoadAPILocations = this.onLoadAPILocations.bind(this);

	}

	async componentDidMount() {
		AppState.addEventListener("change", this.handleAppStateChange);

		BleManager.start({
			showAlert: false
		});

		var boards = await StateBuilder.getBoards();
		if (boards) {
			this.setState({
				boardData: boards,
			});
		}
		
		this.handlerDiscover = bleManagerEmitter.addListener("BleManagerDiscoverPeripheral", this.handleDiscoverPeripheral);
		this.handlerStop = bleManagerEmitter.addListener("BleManagerStopScan", this.handleStopScan);
		this.handlerDisconnect = bleManagerEmitter.addListener("BleManagerDisconnectPeripheral", this.handleDisconnectedPeripheral);

		// this is a hack for android permissions. Not required for IOS.
		if (Platform.OS === "android" && Platform.Version >= 23) {
			PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
				if (result) {
					console.log("BoardManager: Permission is OK");
				} else {
					PermissionsAndroid.requestPermission(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
						if (result) {
							console.log("BoardManager: User accept");
						} else {
							console.log("BoardManager: User refuse");
						}
					});
				}
			});
		}

		// if there is a default peripheral saved, scan and attempt to load that board.
		var config = await FileSystemConfig.getDefaultPeripheral();
		if (config) {
			this.setState({
				boardName: config.name,
			});

			await this.startScan(true);
		}


	}

	handleAppStateChange(nextAppState) {
		if (this.state.appState.match(/inactive|background/) && nextAppState === "active") {
			console.log("BoardManager: App has come to the foreground!");
			BleManager.getConnectedPeripherals([]).then((peripheralsArray) => {
				console.log("BoardManager: Connected boards: " + peripheralsArray.length);
			});
		}
		this.setState({
			appState: nextAppState
		});
	}

	componentWillUnmount() {
		this.handlerDiscover.remove();
		this.handlerStop.remove();
		this.handlerDisconnect.remove();
		if (this.state.backgroundLoop)
			clearInterval(this.state.backgroundLoop);
	}

	handleDisconnectedPeripheral(data) {

		let peripheral = data.peripheral;
		if (peripheral.name == this.state.boardName) {
			peripheral.connected = false;

			if (this.state.backgroundLoop)
				clearInterval(this.state.backgroundLoop);

			this.setState({
				selectedPeripheral: peripheral,
				mediaState: StateBuilder.blankMediaState(),
				discoveryState: DISCONNECTED,
				backgroundLoop: null,
			});
			console.log("BoardManager: Disconnected from " + peripheral.name);
		}
	}

	handleStopScan() {
		console.log("BoardManager: Scan is stopped");
		this.setState({
			scanning: false
		});
	}

	async startScan(automaticallyConnect) {
		if (!this.state.scanning) {

			try {

				console.log("BoardManager: Clearing Interval: ");

				if (this.state.backgroundLoop)
					clearInterval(this.state.backgroundLoop);

				console.log("BoardManager: Clearing State: ");

				this.setState({
					selectedPeripheral: StateBuilder.blankMediaState().peripheral,
					mediaState: StateBuilder.blankMediaState(),
					scanning: true,
					discoveryState: DISCONNECTED,
					peripherals: new Map(),
					automaticallyConnect: automaticallyConnect,
					backgroundLoop: null,
				});

				console.log("BoardManager: Scanning with automatic connect: " + automaticallyConnect);
				await BleManager.scan([BLEIDs.bbUUID], 5, true);
			}
			catch (error) {
				console.log("BoardManager: Failed to Scan: " + error);
			}
		}
	}

	async onSelectPeripheral(peripheral) {
		if (peripheral) {

			if (peripheral.connected) {
				try {
					BleManager.disconnect(peripheral.id);
				}
				catch (error) {
					console.log("BoardManager: Failed to Disconnect" + error);
				}
			} else {

				try {

					// store default in filesystem.
					await FileSystemConfig.setDefaultPeripheral(peripheral);

					var boardName = peripheral.name;

					await BleManager.stopScan();

					if (this.state.backgroundLoop)
						clearInterval(this.state.backgroundLoop);
 
					this.setState({
						selectedPeripheral: peripheral,
						mediaState: StateBuilder.blankMediaState(),
						showScreen: MEDIA_MANAGEMENT,
						boardName: boardName,
						discoveryState: DISCONNECTED,
						scanning: false,
						backgroundLoop: null,
					});


					await this.startScan(true);
				}
				catch (error) {
					console.log("BoardManager: Connection error", error);
				}
			}
		}
	}

	async onLoadAPILocations() {
		this.setState({ mediaState: await await BBComAPIData.fetchLocations(this.state.mediaState) });
	}
	async onUpdateVolume(event) {
		this.setState({ mediaState: await BLEBoardData.onUpdateVolume(event, this.state.mediaState) });
	}
	async onSelectAudioTrack(idx) {
		this.setState({ mediaState: await BLEBoardData.setTrack(this.state.mediaState, "Audio", idx) });
	}
	async onSelectVideoTrack(idx) {
		this.setState({ mediaState: await BLEBoardData.setTrack(this.state.mediaState, "Video", idx) });
	}
	async onSelectDevice(idx) {
		this.setState({ mediaState: await BLEBoardData.setTrack(this.state.mediaState, "Device", idx) });
	}
	async onRefreshDevices() {
		this.setState({ mediaState: await BLEBoardData.refreshDevices(this.state.mediaState) });
	}

	async handleDiscoverPeripheral(peripheral) {
		try {

			// add to the list of peripherals for the board picker.
			var peripherals = this.state.peripherals;
			if (!peripherals.has(peripheral.id)) {

				console.log("BoardManager Found New Peripheral:" + peripheral.name);

				peripheral.connected = false;
				peripherals.set(peripheral.id, peripheral);

				this.setState({ peripherals: peripherals, });

				// if it is your default peripheral, connect automatically.
				if (peripheral.name == this.state.boardName) {

					this.setState({
						selectedPeripheral: peripheral,
					});

					if (this.state.automaticallyConnect) {
						console.log("BoardManager: Automatically Connecting To: " + peripheral.name);
						this.setState({ discoveryState: LOCATED });

						var mediaState = await StateBuilder.createMediaState(this.state.selectedPeripheral);

						var foundBoard = this.state.boardData.filter((board) => {
							return board.name == this.state.boardName;
						});
						var color = foundBoard[0].color;

						this.setState({
							mediaState: mediaState,
							discoveryState: CONNECTED,
							boardColor: color,
						});

						// Kick off a per-second location reader 
						await this.readLocationLoop(this.state.mediaState);
						console.log("BoardManager: Begin Background Location Loop");
					}
				}
			}
		}
		catch (error) {
			console.log("BoardManager Found Peripheral Error:" + error);
		}
	}

	async readLocationLoop() {

		var backgroundTimer = setInterval(async () => {
			console.log("Location Loop");
			if (this.state.mediaState) {
				console.log("Found Media State");
				try {
					var mediaState = await BLEBoardData.readLocation(this.state.mediaState);
					console.log("Called Location Update");
					this.setState({
						mediaState: mediaState,
					});
				}
				catch (error) {
					console.log("BoardManager Location Loop Failed:" + error);
				}
			}
		}, 8000);
		this.setState({ backgroundLoop: backgroundTimer });
	}
 
	render() {

		const list = Array.from(this.state.peripherals.values());
		const dataSource = ds.cloneWithRows(list);

		var color = "#fff";
		var enableControls = "none";
		var connectionButtonText = "";

		switch (this.state.discoveryState) {
		case DISCONNECTED:
			color = "#fff";
			enableControls = "none";
			connectionButtonText = "Connect to Boards";
			break;
		case LOCATED:
			color = "yellow";
			enableControls = "none";
			connectionButtonText = "Located " + this.state.boardName;
			break;
		case CONNECTED:
			if (!this.state.mediaState.isError)  
				color = "green";	 
			else  
				color = "red";
			enableControls = "auto";
			connectionButtonText = "Connected To " + this.state.boardName;
			break;
		}

		if (!(this.state.showScreen == DISCOVER))

			return (
				<View style={styles.container}>
					<View style={styles.contentContainer}>
						{(this.state.showScreen == MEDIA_MANAGEMENT) ? <MediaManagement pointerEvents={enableControls} mediaState={this.state.mediaState} onUpdateVolume={this.onUpdateVolume} onSelectAudioTrack={this.onSelectAudioTrack} onSelectVideoTrack={this.onSelectVideoTrack} onLoadAPILocations={this.onLoadAPILocations} />
							: (this.state.showScreen == DIAGNOSTIC) ? <Diagnostic pointerEvents={enableControls} mediaState={this.state.mediaState} />
								: <AdminManagement pointerEvents={enableControls} mediaState={this.state.mediaState} onSelectDevice={this.onSelectDevice} onRefreshDevices={this.onRefreshDevices} />
						}

						<Touchable
							onPress={async () => {
								await this.startScan(true);
							}
							}
							style={{
								backgroundColor: color,
								height: 50,
							}}
							background={Touchable.Ripple("blue")}>
							<Text style={styles.rowText}>{connectionButtonText} {this.state.scanning ? "(scanning)" : ""}</Text>
						</Touchable>
						<View style={styles.footer}>
							<View style={styles.button}>
								<Touchable
									onPress={async () => {
										if (!this.state.scanning) {

											try {
												await BleManager.disconnect(this.state.selectedPeripheral.id);
											}
											catch (error) {
												console.log("BoardManager: Pressed Search For Boards: " + error);
											}

											if (this.state.backgroundLoop)
												clearInterval(this.state.backgroundLoop);

											this.setState({
												peripherals: new Map(),
												appState: "",
												selectedPeripheral: StateBuilder.blankMediaState().peripheral,
												mediaState: StateBuilder.blankMediaState(),
												showScreen: DISCOVER,
												discoveryState: DISCONNECTED,
												backgroundLoop: null,
											});
										}
									}}
									style={{
										height: 50,
									}}
									background={Touchable.Ripple("blue")}>
									<Text style={styles.rowText}>Search for Boards</Text>
								</Touchable>
							</View>
							<View style={styles.button}>
								<Touchable
									onPress={async () => {

										var newScreen;
										if (this.state.showScreen == MEDIA_MANAGEMENT) {
											newScreen = ADMINISTRATION;
										} else if ((this.state.showScreen == ADMINISTRATION)) {
											newScreen = DIAGNOSTIC;
										} else if (this.state.showScreen == DIAGNOSTIC) {
											newScreen = MEDIA_MANAGEMENT;
										}

										this.setState({
											showScreen: newScreen,
										});

									}}
									style={{
										height: 50,
									}}
									background={Touchable.Ripple("blue")}>
									<Text style={styles.rowText}>
										{
											(this.state.showScreen == MEDIA_MANAGEMENT) ? "Administration"
												: (this.state.showScreen == ADMINISTRATION) ? "Diagnostic"
													: "Media Management"
										}
									</Text>
								</Touchable>
							</View>
						</View>
					</View>
				</View>);
		else
			return (
				<View style={styles.container}>

					<Touchable
						onPress={() => this.startScan(false)}
						style={styles.touchableStyle}
						background={Touchable.Ripple("blue")}>
						<Text style={styles.rowText}>Scan for Burner Boards ({this.state.scanning ? "scanning" : "paused"})</Text>
					</Touchable>

					<ScrollView style={styles.scroll}>
						{(list.length == 0) &&
							<Text style={styles.rowText}>No Boards Found</Text>
						}
						<ListView
							enableEmptySections={true}
							dataSource={dataSource}
							renderRow={(item) => {

								var foundBoard = this.state.boardData.filter((board) => {
									return board.name == item.name;
								});

								var color = foundBoard[0].color;

								return (

									<Touchable
										onPress={async () => await this.onSelectPeripheral(item)}
										style={[styles.touchableStyle, { backgroundColor: color }]}

										background={Touchable.Ripple("blue")}>
										<Text style={styles.rowText}>{item.name}</Text>
									</Touchable>

								);
							}}
						/>
					</ScrollView>
				</View>
			);
	}
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#FFF",
	},
	contentContainer: {
		flex: 1 // pushes the footer to the end of the screen
	},
	rowText: {
		margin: 5,
		fontSize: 14,
		textAlign: "center",
		padding: 10,
	},
	touchableStyle: {
		backgroundColor: "lightblue",
		margin: 5,
	},
	footer: {
		height: 50,
		flexDirection: "row",
		justifyContent: "space-between"
	},
	button: {
		width: "50%",
		height: 50
	}
});
