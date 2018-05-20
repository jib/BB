import React, { Component } from "react";
import GoogleLogin from "react-google-login";

class GoogleLoginPage extends Component {

	constructor(props) {

		super(props);

		this.state = {
			buttonText: props.buttonText,
		};
		this.responseGoogle = this.props.responseGoogle.bind(this);

		console.log("Clear the JWT from SessionStorage.");
		window.sessionStorage.removeItem("JWT");
	}

	componentWillReceiveProps(nextProps) {
		this.setState({
			buttonText: nextProps.buttonText,
		});

	}

	render() {
		return (
			<div>
				<div style={{
					"margin": "1cm 1cm 1cm 1cm",
					"padding": "10px 5px 15px 20px",
					"text-align": "center"

				}}>
					<div><img alt="" rel="bb" height="32" width="32" src={require("./images/BurnerBoardIcon.png")} />
						Welcome to BurnerBoard.com!
						<img alt="" rel="bb" height="32" width="32" src={require("./images/BurnerBoardIcon.png")} /></div>
				</div>
				<div style={{
					"backgroundColor": "lightblue",
					"margin": "1cm 1cm 1cm 1cm",
					"padding": "10px 5px 15px 20px",
					"text-align": "center"
				}}>

					<img alt="" rel="bb" height="24" width="24" src={require("./images/google logo 64.png")} />
					<GoogleLogin
						clientId="845419422405-4e826kofd0al1npjaq6tijn1f3imk43p.apps.googleusercontent.com"
						buttonText={this.state.buttonText}
						accessType="offline"
						onSuccess={this.responseGoogle}
						onFailure={this.responseGoogle}
						scope="https://www.googleapis.com/auth/drive.readonly"
						style={{
							"backgroundColor": "lightblue",
							"border": "none",
							"font-family": "sans-serif"
						}}
					/>
					<img alt="" rel="bb" height="24" width="24" src={require("./images/google logo 64.png")} />
				</div>
			</div>
		);

	}
}


export default GoogleLoginPage;