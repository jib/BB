package com.richardmcdougall.bb;

import android.app.IntentService;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.os.Handler;
import android.os.ResultReceiver;
import android.support.v4.content.LocalBroadcastManager;
import android.support.v7.app.AppCompatActivity;
import android.util.Log;
import android.app.Activity;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.View;
import android.widget.CompoundButton;
import android.widget.EditText;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.ImageView;
import android.view.MotionEvent;
import android.content.BroadcastReceiver;

public class MainActivity extends AppCompatActivity implements InputManagerCompat.InputDeviceListener {

    private static final String TAG = "BB.MainActivity";

    private Context mContext;

    boolean imRunning = false;

    TextView voltage;
    TextView status;
    EditText log;
    TextView syncStatus = null;
    TextView syncPeers = null;
    TextView syncReplies = null;
    TextView syncAdjust;
    TextView syncTrack;
    TextView syncUsroff;
    TextView syncSrvoff;
    TextView syncRTT;
    TextView modeStatus;
    private android.widget.Switch switchHeadlight;

    private VisualizerView mVisualizerView;
    private String stateMsgAudio = "";
    private String stateMsgConn = "";
    private String stateMsg = "";

    private InputManagerCompat remoteControl;

    // TODO: Rename actions, choose action names that describe tasks that this
    // IntentService can perform, e.g. ACTION_FETCH_NEW_ITEMS
    private static final String ACTION_LIGHTS = "com.richardmcdougall.bb.action.LIGHTS";
    private static final String ACTION_MUSIC = "com.richardmcdougall.bb.action.MUSIC";

    // TODO: Rename parameters
    private static final String EXTRA_PARAM1 = "com.richardmcdougall.bb.extra.PARAM1";
    private static final String EXTRA_PARAM2 = "com.richardmcdougall.bb.extra.PARAM2";


    /**
     * Starts this service to perform action Foo with the given parameters. If
     * the service is already performing a task this action will be queued.
     *
     * @see IntentService
     */
    // TODO: Customize helper method
    public static void startActionLights(Context context, String param1, String param2) {
        Intent intent = new Intent(context, BBIntentService.class);
        intent.setAction(ACTION_LIGHTS);
        intent.putExtra(EXTRA_PARAM1, param1);
        intent.putExtra(EXTRA_PARAM2, param2);
        context.startService(intent);
    }

    /**
     * Starts this service to perform action Baz with the given parameters. If
     * the service is already performing a task this action will be queued.
     *
     * @see IntentService
     */
    // TODO: Customize helper method
    public static void startActionMusic(Context context, String param1, String param2) {
        Intent intent = new Intent(context, BBIntentService.class);
        intent.setAction(ACTION_MUSIC);
        intent.putExtra(EXTRA_PARAM1, param1);
        intent.putExtra(EXTRA_PARAM2, param2);
        context.startService(intent);
    }


    //private Handler pHandler = new Handler();

    //public String bleStatus = "hello BLE";


    // function to append a string to a TextView as a new line
    // and scroll to the bottom if needed
    private void l(String msg) {
        if (log == null)
            return;
        // append the new string
        log.append(msg + "\n");
        // find the amount we need to scroll.  This works by
        // asking the TextView's internal layout for the position
        // of the final line and then subtracting the TextView's height
        final android.text.Layout layout = log.getLayout();

        if (layout != null) {
            final int scrollAmount = layout.getLineTop(log.getLineCount()) - log.getHeight();
            // if there is no need to scroll, scrollAmount will be <=0
            if (scrollAmount > 0)
                log.scrollTo(0, scrollAmount);
            else
                log.scrollTo(0, 0);
        }
        Log.v(TAG, msg);
    }

    public void setStateMsgConn(String str) {
        synchronized (stateMsg) {
            stateMsgConn = str;
            stateMsg = stateMsgConn + "," + stateMsgAudio;

        }
    }


    public void setStateMsgAudio(String str) {
        synchronized (stateMsg) {
            stateMsgAudio = str;
            stateMsg = stateMsgConn + "," + stateMsgAudio;
        }
    }

    // Define the callback for what to do when data is received
    private BroadcastReceiver BBReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            int resultCode = intent.getIntExtra("resultCode", RESULT_CANCELED);
            int msgType = intent.getIntExtra("msgType", 0);
            if (resultCode == RESULT_OK) {
                switch (msgType) {
                    case 1:
                        long seekErr = intent.getLongExtra("seekErr", 0);
                        syncAdjust.setText(String.format("%1$d", seekErr));
                        int currentRadioStream = intent.getIntExtra("currentRadioStream", 0);
                        syncTrack.setText(String.format("%1$d", currentRadioStream));
                        int userTimeOffset = intent.getIntExtra("userTimeOffset", 0);
                        syncUsroff.setText(String.format("%1$d", userTimeOffset));
                        long serverTimeOffset = intent.getLongExtra("serverTimeOffset", 0);
                        syncSrvoff.setText(String.format("%1$d", serverTimeOffset));
                        long serverRTT = intent.getLongExtra("serverRTT", 0);
                        syncRTT.setText(String.format("%1$d", serverRTT));
                        String stateMsgAudio = intent.getStringExtra("stateMsgAudio");
                        setStateMsgAudio(stateMsgAudio);
                        break;
                    case 2:
                        long stateReplies = intent.getLongExtra("stateReplies", 0);
                        syncReplies.setText(String.format("%1$d", stateReplies));
                        String stateMsgWifi = intent.getStringExtra("stateMsgWifi");
                        setStateMsgConn(stateMsgWifi);
                        break;

                    default:
                        break;
                }
            }
            syncStatus.setText(stateMsg);
        }

    };


    @Override
    protected void onCreate(Bundle savedInstanceState) {

        l("MainActivity: onCreate()");
        super.onCreate(savedInstanceState);

        // Connect the remote control
        remoteControl = InputManagerCompat.Factory.getInputManager(getApplicationContext());
        remoteControl.registerInputDeviceListener(this, null);
        int[] devs = remoteControl.getInputDeviceIds();
        for (int dev : devs) {
            l("Input dev" + dev);
            if (dev > 0) {
                InputDevice device = remoteControl.getInputDevice(dev);
                l("Device" + device.toString());
            }
        }

        setContentView(R.layout.activity_main);

        // Create the graphic equalizer
        mVisualizerView = (VisualizerView) findViewById(R.id.myvisualizerview);


        // Create textview
        voltage = (TextView) findViewById(R.id.textViewVoltage);
        modeStatus = (TextView) findViewById(R.id.modeStatus);
        status = (TextView) findViewById(R.id.textViewStatus);
        syncStatus = (TextView) findViewById(R.id.textViewsyncstatus);
        syncPeers = (TextView) findViewById(R.id.textViewsyncpeers);
        syncReplies = (TextView) findViewById(R.id.textViewsyncreplies);
        syncAdjust = (TextView) findViewById(R.id.textViewsyncadjust);
        syncTrack = (TextView) findViewById(R.id.textViewsynctrack);
        syncUsroff = (TextView) findViewById(R.id.textViewsyncusroff);
        syncSrvoff = (TextView) findViewById(R.id.textViewsyncsrvoff);
        syncRTT = (TextView) findViewById(R.id.textViewsyncrtt);

        // Create the logging window
        log = (EditText) findViewById(R.id.editTextLog);
        log.setMovementMethod(new android.text.method.ScrollingMovementMethod());

        voltage.setText("0.0v");
        log.setText("Hello");
        log.setFocusable(false);

        switchHeadlight = (android.widget.Switch) findViewById(R.id.switchHeadlight);
        switchHeadlight.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
                //boardSetHeadlight(isChecked);
            }
        });

        startService(new Intent(getBaseContext(), BBService.class));

        //startActionMusic(getApplicationContext(), "", "");

        //MusicReset();


        //try {
        //    mVisualizerView.link(mediaPlayer.getAudioSessionId());
        //    mVisualizerView.addBarGraphRendererBottom();
        //mVisualizerView.addBurnerBoardRenderer(this);
        //} catch (Exception e) {
        //    l("Cannot start visualizer!" + e.getMessage());
        //

    }


    private void updateStatus() {
        float volts;

//        volts = boardGetVoltage();
        volts = 0.0f;

        if (volts > 0) {
            voltage.setText(String.format("%.2f", volts) + "v");
        }

    }

    @Override
    protected void onResume() {
        l("MainActivity: onResume()");

        super.onResume();

//        if (mWifi != null)
//            mWifi.onResume();

//        loadPrefs();

//        initUsb();

        // Register for the particular broadcast based on ACTION string
        IntentFilter filter = new IntentFilter(BBService.ACTION_STATS);
        LocalBroadcastManager.getInstance(this).registerReceiver(BBReceiver, filter);

    }

    @Override
    protected void onPause() {
        l("MainActivity: onPause()");

        super.onPause();


        //       if (mWifi != null)
        //         mWifi.onPause();


//        savePrefs();

//        stopIoManager();

        // Unregister the listener when the application is paused
        LocalBroadcastManager.getInstance(this).unregisterReceiver(BBReceiver);

    }


    public void onModeDown(View v) {
        Intent in = new Intent(BBService.ACTION_BUTTONS);
        in.putExtra("resultCode", Activity.RESULT_OK);
        in.putExtra("buttonType", BBService.buttons.BUTTON_MODE_DOWN);
        LocalBroadcastManager.getInstance(this).sendBroadcast(in);
        //   boardSetMode(98);
        //  if ((boardMode = boardGetMode()) == -1)
        //     boardMode--;
        //modeStatus.setText(String.format("%d", boardMode));
    }

    public void onModeUp(View v) {
        Intent in = new Intent(BBService.ACTION_BUTTONS);
        in.putExtra("resultCode", Activity.RESULT_OK);
        in.putExtra("buttonType", BBService.buttons.BUTTON_MODE_UP);
        LocalBroadcastManager.getInstance(this).sendBroadcast(in);
        //   boardSetMode(99);
        // if ((boardMode = boardGetMode()) == -1)
        //    boardMode++;
        //modeStatus.setText(String.format("%d", boardMode));
    }


    public void onNextTrack(View v) {
        Intent in = new Intent(BBService.ACTION_BUTTONS);
        in.putExtra("resultCode", Activity.RESULT_OK);
        in.putExtra("buttonType", BBService.buttons.BUTTON_TRACK);
        LocalBroadcastManager.getInstance(this).sendBroadcast(in);
        //NextStream();
    }

    public void onDriftDown(View v) {
        Intent in = new Intent(BBService.ACTION_BUTTONS);
        in.putExtra("resultCode", Activity.RESULT_OK);
        in.putExtra("buttonType", BBService.buttons.BUTTON_DRIFT_DOWN);
        LocalBroadcastManager.getInstance(this).sendBroadcast(in);
        //MusicOffset(-2);
    }

    public void onDriftUp(View v) {
        Intent in = new Intent(BBService.ACTION_BUTTONS);
        in.putExtra("resultCode", Activity.RESULT_OK);
        in.putExtra("buttonType", BBService.buttons.BUTTON_DRIFT_UP);
        LocalBroadcastManager.getInstance(this).sendBroadcast(in);
        //MusicOffset(2);
    }


    /*
   * When an input device is added, we add a ship based upon the device.
   * @see
   * com.example.inputmanagercompat.InputManagerCompat.InputDeviceListener
   * #onInputDeviceAdded(int)
   */
    @Override
    public void onInputDeviceAdded(int deviceId) {
        l("onInputDeviceAdded");

    }

    /*
     * This is an unusual case. Input devices don't typically change, but they
     * certainly can --- for example a device may have different modes. We use
     * this to make sure that the ship has an up-to-date InputDevice.
     * @see
     * com.example.inputmanagercompat.InputManagerCompat.InputDeviceListener
     * #onInputDeviceChanged(int)
     */
    @Override
    public void onInputDeviceChanged(int deviceId) {
        l("onInputDeviceChanged");

    }

    /*
     * Remove any ship associated with the ID.
     * @see
     * com.example.inputmanagercompat.InputManagerCompat.InputDeviceListener
     * #onInputDeviceRemoved(int)
     */
    @Override
    public void onInputDeviceRemoved(int deviceId) {
        l("onInputDeviceRemoved");
    }

    public boolean onKeyDown(int keyCode, KeyEvent event) {
        boolean handled = false;
        if (event.getRepeatCount() == 0) {
            l("Keycode:" + keyCode);
            //System.out.println("Keycode: " + keyCode);
        }

        Intent in = new Intent(BBService.ACTION_BUTTONS);
        in.putExtra("resultCode", Activity.RESULT_OK);
        in.putExtra("buttonType", BBService.buttons.BUTTON_KEYCODE);
        in.putExtra("keyCode", keyCode);
        in.putExtra("keyEvent", event);
        // Fire the broadcast with intent packaged
        LocalBroadcastManager.getInstance(this).sendBroadcast(in);


        if ((event.getSource() & InputDevice.SOURCE_GAMEPAD)
                == InputDevice.SOURCE_GAMEPAD) {

            if (handled) {
                return true;
            }
        }

        return super.onKeyDown(keyCode, event);
    }


}


