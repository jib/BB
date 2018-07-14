import React, { Component } from "react";
import { View, Text, StyleSheet } from "react-native";
import PropTypes from "prop-types";
import Touchable from "react-native-platform-touchable";
import StateBuilder from "./StateBuilder";
import Picker from "react-native-wheel-picker";
var PickerItem = Picker.Item;

export default class TrackController extends Component {
	constructor(props) {
		super(props);
		this.state = {
			refreshButtonClicked: false,
		};

		this.onSelectTrack = this.props.onSelectTrack.bind(this);
		if (this.props.refreshFunction)
			this.refreshFunction = this.props.refreshFunction.bind(this);
	}

	render() {

		var tracks = null;
		var channelNo = null;

		if (this.props.mediaType == "Audio") {
			tracks = this.props.mediaState.audio.channels.map((a) => {
				return a.channelInfo;
			});
			channelNo = this.props.mediaState.audio.channelNo;
		}
		else if (this.props.mediaType == "Device") {
			tracks = this.props.mediaState.device.devices.map((a) => {
				return a.deviceLabel;
			});
			channelNo = this.props.mediaState.device.deviceNo;
		}
		else {
			tracks = this.props.mediaState.video.channels.map((a) => {
				return a.channelInfo;
			});
			channelNo = this.props.mediaState.video.channelNo;
		}

		var refreshButton;
		if (this.props.refreshFunction) {
			refreshButton = (
				<View style={styles.button}>
					<Touchable
						onPress={async () => {

							this.setState({ mediaState: await this.props.refreshFunction() });

							return true;
						}}
						style={[styles.touchableStyle]}
						background={Touchable.Ripple("blue")}>
						<Text style={styles.rowTextCenter}> Refresh BT Devices
						</Text>
					</Touchable>
				</View>
			);
		}
		else
			refreshButton = (<Text></Text>);

		if (tracks.length > 1)
			tracks = tracks.slice(1, tracks.length);

		return (

			<View style={{ margin: 10, backgroundColor: "skyblue", }}>
				<View style={{
					flex: 1,
					flexDirection: "row",
				}}>
					<View>
						<Text style={styles.rowText}>{this.props.mediaType} Track</Text>
					</View>
				</View>
				<View style={styles.container}>
					<View style={styles.contentContainer}>

						<Picker style={{ height: 200 }}
							selectedValue={this.state.selectedValue}
							itemStyle={{ color: "black", fontSize: 26 }}
							onValueChange={async (index) => {

								this.setState({ selectedValue: index });

								if (tracks[0] == "loading...") {
									console.log("dont call update if its a component load");
									return;
								}
								if ((channelNo - 1) == index) {
									console.log("dont call update if its not a real change");
									return;
								}

								var selected = null;

								if (this.props.mediaType == "Audio") {
									selected = this.props.mediaState.audio.channels.filter((a) => {
										return a.channelInfo == tracks[index];
									});
									this.onSelectTrack(selected[0].channelNo);
								}
								else if (this.props.mediaType == "Device") {
									selected = this.props.mediaState.device.devices.filter((a) => {
										return a.deviceLabel == tracks[index];
									});
									this.onSelectTrack(selected[0].deviceNo);
								}
								else {
									selected = this.props.mediaState.video.channels.filter((a) => {
										return a.channelInfo == tracks[index];
									});
									this.onSelectTrack(selected[0].channelNo);
								}
							}}>

							{tracks.map((value, i) => (
								<PickerItem label={value} value={i} key={"money" + value} />
							))}

						</Picker>
					</View>
					</View>
				{refreshButton}
				</View>
				);
			}
		}
		
TrackController.defaultProps = {
					mediaState: StateBuilder.blankMediaState(),
			};
			
TrackController.propTypes = {
					mediaType: PropTypes.string,
				mediaState: PropTypes.object,
				onSelectTrack: PropTypes.func,
				refreshFunction: PropTypes.func,
				displayRefreshButton: PropTypes.bool,
			};
			
const styles = StyleSheet.create({
					rowText: {
					margin: 5,
				fontSize: 14,
				padding: 5,
			},
	rowTextCenter: {
					margin: 5,
				fontSize: 14,
				textAlign: "center",
				padding: 10,
			},
		});
