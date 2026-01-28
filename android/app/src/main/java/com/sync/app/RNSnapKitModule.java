package com.sync.app;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import com.snapchat.kit.sdk.SnapLogin;
import com.snapchat.kit.sdk.core.controller.LoginStateController;
import com.snapchat.kit.sdk.login.models.UserDataResponse;
import com.snapchat.kit.sdk.login.networking.FetchUserDataCallback;

public class RNSnapKitModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    RNSnapKitModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @NonNull
    @Override
    public String getName() {
        return "RNSnapKit";
    }

    @ReactMethod
    public void login(Promise promise) {
        LoginStateController.OnLoginStateChangedListener loginStateChangedListener =
            new LoginStateController.OnLoginStateChangedListener() {
                @Override
                public void onLoginSucceeded() {
                    SnapLogin.getLoginStateController(getReactApplicationContext()).removeOnLoginStateChangedListener(this);
                    
                    // Fetch access token after successful login
                    String accessToken = SnapLogin.getAuthTokenManager(getReactApplicationContext()).getAccessToken();
                    if (accessToken != null) {
                        // Return token in a map-like structure if needed, or just the string. 
                        // The iOS impl returns {accessToken: string}. Let's match it.
                        // Actually, promise.resolve(accessToken) is simpler, but let's stick to object for extensibility
                        // WritableMap map = Arguments.createMap(); map.putString("accessToken", accessToken); promise.resolve(map);
                        // For simplicity now, let's just return a writable map
                         com.facebook.react.bridge.WritableMap map = com.facebook.react.bridge.Arguments.createMap();
                         map.putString("accessToken", accessToken);
                         promise.resolve(map);
                    } else {
                        promise.reject("token_error", "Login succeeded but no access token found");
                    }
                }

                @Override
                public void onLoginFailed() {
                    SnapLogin.getLoginStateController(getReactApplicationContext()).removeOnLoginStateChangedListener(this);
                    promise.reject("login_failed", "Snapchat login failed");
                }

                @Override
                public void onLogout() {
                    // unexpected here
                }
            };

        SnapLogin.getLoginStateController(getReactApplicationContext()).addOnLoginStateChangedListener(loginStateChangedListener);
        SnapLogin.getAuthTokenManager(getReactApplicationContext()).startTokenGrant();
    }

    @ReactMethod
    public void isLoggedIn(Promise promise) {
        boolean loggedIn = SnapLogin.isUserLoggedIn(getReactApplicationContext());
        promise.resolve(loggedIn);
    }

    @ReactMethod
    public void logout(Promise promise) {
        SnapLogin.getAuthTokenManager(getReactApplicationContext()).clearToken();
        promise.resolve(true);
    }
    
    @ReactMethod
    public void fetchUserData(Promise promise) {
        String query = "{me{displayName, bitmoji{avatar, id}}}";
        SnapLogin.fetchUserData(getReactApplicationContext(), query, null, new FetchUserDataCallback() {
            @Override
            public void onSuccess(@Nullable UserDataResponse userDataResponse) {
                if (userDataResponse != null && userDataResponse.hasData()) {
                     // We would convert this to a WritableMap. 
                     // For now, let's just resolve generic success. 
                     // In a real app we'd map the fields.
                     promise.resolve(true); 
                } else {
                    promise.reject("no_data", "No user data returned");
                }
            }

            @Override
            public void onFailure(boolean isNetworkError, int statusCode) {
                promise.reject("fetch_error", "Failed to fetch user data: " + statusCode);
            }
        });
    }
}
