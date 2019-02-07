import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import ReactCodeInput from 'react-code-input';

import { addNotification, setLock, setRoomName } from 'actions';

// FIXME: temporary button for submitting while waiting for designs
import { NavButton } from 'features/nav-button';

import { getRemoteControlServerConfig, isConnectedToSpot } from 'reducers';
import { remoteControlService } from 'remote-control';
import { ROUTES } from 'routing';
import { logger } from 'utils';


import View from './view';

/**
 * Displays a view to enter a join code for connecting with a Spot instance.
 *
 * @extends React.Component
 */
export class JoinCodeEntry extends React.Component {
    static defaultProps = {
        entryLength: 6
    };

    static propTypes = {
        dispatch: PropTypes.func,
        entryLength: PropTypes.number,
        history: PropTypes.object,
        isConnectedToSpot: PropTypes.bool,
        location: PropTypes.object,
        remoteControlConfiguration: PropTypes.object
    };

    /**
     * Initializes a new {@code JoinCodeEntry} instance.
     *
     * @param {Object} props - The read-only properties with which the new
     * instance is to be initialized.
     */
    constructor(props) {
        super(props);

        this.state = {
            enteredCode: ''
        };

        this._onCodeChange = this._onCodeChange.bind(this);
        this._onSubmit = this._onSubmit.bind(this);
    }

    /**
     * Ensures no Spot connection is running while trying to connect to another
     * instance of Spot.
     *
     * @inheritdoc
     */
    componentDidMount() {
        remoteControlService.disconnect();

        const queryParams = new URLSearchParams(this.props.location.search);
        const code = queryParams.get('code');

        // Hide the code and other params for visual clarity only, no practical
        // purpose.
        this.props.history.replace(this.props.location.pathname);

        if (code) {
            this._connectToSpot(code);
        }
    }

    /**
     * Redirects to the remote control view when a connection to Spot is
     * established.
     *
     * @inheritdoc
     */
    componentDidUpdate(prevProps) {
        if (!prevProps.isConnectedToSpot && this.props.isConnectedToSpot) {
            this.props.history.push(ROUTES.REMOTE_CONTROL);
        }
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     */
    render() {
        return (
            <View
                hideBackground = { true }
                name = 'join-code'>
                <div className = 'container'>
                    {
                        this.state.validating
                            ? <div className = 'connecting'>Connecting...</div>
                            : <div className = 'join-code-view'>
                                <div className = 'cta'>Enter a share key</div>
                                <div data-qa-id = { 'join-code-input' }>
                                    <ReactCodeInput
                                        fields = { this.props.entryLength }
                                        forceUppercase = { true }
                                        onChange = { this._onCodeChange }
                                        type = 'text'
                                        value = { this.state.enteredCode } />
                                </div>
                                <NavButton
                                    iconName = 'arrow_forward'
                                    onClick = { this._onSubmit }
                                    qaId = 'join-code-submit' />
                            </div>
                    }
                </div>
            </View>
        );
    }

    /**
     * Callback invoked to update the known entered join code.
     *
     * @param {string} enteredCode - The entered code so far.
     * @private
     * @returns {void}
     */
    _onCodeChange(enteredCode) {
        this.setState({ enteredCode });
    }

    /**
     * Callback invoked to validate the join code and connect to a Spot.
     *
     * @private
     * @returns {void}
     */
    _onSubmit() {
        this._connectToSpot(this.state.enteredCode);
    }

    /**
     * Validates the passed in code and starts the connection to the Spot.
     *
     * @param {string} code - The code for becoming a remote control to a Spot.
     * @private
     * @returns {void}
     */
    _connectToSpot(code) {
        const submitPromise = new Promise(resolve => {
            this.setState({ validating: true }, resolve);
        });

        // FIXME: There is no proper join code service so the code is a
        // combination of a 3 digit room name and a 3 digit room password.
        const roomName = code.substring(0, 3).toLowerCase();
        const password = code.substring(3, 6).toLowerCase();

        submitPromise
            .then(() => remoteControlService.exchangeCode(code))
            .then(() => {
                this.props.dispatch(setRoomName(roomName));
                this.props.dispatch(setLock(password));

                return remoteControlService.connect({
                    lock: password,
                    roomName,
                    serverConfig: this.props.remoteControlConfiguration
                });
            })
            .catch(error => {
                logger.error('Error while connecting to spot:', error);

                this.props.dispatch(
                    addNotification('error', 'Something went wrong'));

                remoteControlService.disconnect();

                this.props.dispatch(setRoomName(''));
                this.props.dispatch(setLock(''));

                this.setState({ validating: false });
            });
    }
}

/**
 * Selects parts of the Redux state to pass in with the props of
 * {@code JoinCodeEntry}.
 *
 * @param {Object} state - The Redux state.
 * @private
 * @returns {Object}
 */
function mapStateToProps(state) {
    return {
        isConnectedToSpot: isConnectedToSpot(state),
        remoteControlConfiguration: getRemoteControlServerConfig(state)
    };
}

export default connect(mapStateToProps)(JoinCodeEntry);
