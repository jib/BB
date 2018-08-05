import React from "react";
import { Text, View } from "react-native";
import MapView from "react-native-maps";
import PropTypes from "prop-types";
import Touchable from "react-native-platform-touchable";
import StateBuilder from "./StateBuilder";
import StyleSheet from "./StyleSheet";
import GeoJSON from "./GeoJSON";
import Fence from "./geo/fence";
//import Outline from "./geo/outline";
import Points from "./geo/points";
import Streets from "./geo/streets";
import Toilets from "./geo/toilets";

export default class MapController extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			autoZoom: false,
			latitude: 0,
			longitude: 0,
		};
	}

	componentDidMount() {

		navigator.geolocation.getCurrentPosition(
			(position) => {
				this.setState({
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
					error: null,
				});
			},
			(error) => this.setState({ error: error.message }),
			{ enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }, );

	}
	render() {

		try {

			var locations;
			var region;

			locations = StateBuilder.getLocations(this.props.mediaState, this.props.userPrefs.wifiLocations);

			if (this.state.autoZoom == true)
				region = this.props.mediaState.region;
			else
				region = null;

			return (
				<View style={StyleSheet.mapView}>
					<MapView style={StyleSheet.map} region={region} >
						{locations.map(marker => {

							var ONE_DAY = 24 * 60 * 60 * 1000; /* ms */
							var THIRTY_MIN = 30 * 60 * 1000; /* ms */
							var FIVE_MIN = 5 * 60 * 1000;
							var pinColor;

							if (((new Date()) - new Date(marker.dateTime)) < FIVE_MIN)
								pinColor = "green";
							else if (((new Date()) - new Date(marker.dateTime)) < THIRTY_MIN)
								pinColor = "blue";
							else if (((new Date()) - new Date(marker.dateTime)) < ONE_DAY)
								pinColor = "red";

							return (
								<MapView.Marker
									key={marker.title}
									coordinate={{
										latitude: marker.latitude,
										longitude: marker.longitude
									}}
									title={marker.title}
									pinColor={pinColor}
								/>
							);
						})}
						{this.props.userPrefs.includeMeOnMap ?
							<MapView.Marker
								key={"me"}
								coordinate={{
									latitude: this.state.latitude,
									longitude: this.state.longitude
								}}
								title={"me"}
							/>
							: <View />}
						<GeoJSON geojson={Streets.streets} userPrefs={this.props.userPrefs} />
						<GeoJSON geojson={Fence.fence} userPrefs={this.props.userPrefs} />
						{(this.props.userPrefs.mapPoints) ? <GeoJSON geojson={Points.points} pinColor="black" userPrefs={this.props.userPrefs} /> : <View />}
						{(this.props.userPrefs.mapPoints) ? <GeoJSON geojson={Toilets.toilets} pinColor="brown" userPrefs={this.props.userPrefs} /> : <View />}
					</MapView>
					<View style={StyleSheet.button}>
						<Touchable
							onPress={() => {
								if (this.state.autoZoom == true)
									this.setState({
										autoZoom: false
									});
								else
									this.setState({
										autoZoom: true
									});
							}
							}
							style={[{ backgroundColor: this.state.autoZoom ? "green" : "skyblue" }]}
							background={Touchable.Ripple("blue")}>
							<Text style={StyleSheet.buttonTextCenter}>Auto Zoom</Text>
						</Touchable>
					</View>
				</View>
			);
		}
		catch (error) {
			console.log("MapController: Error:" + error);
		}

	}
}

MapController.propTypes = {
	mediaState: PropTypes.object,
	userPrefs: PropTypes.object,
};
