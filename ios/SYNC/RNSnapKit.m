#import "RNSnapKit.h"
#import <SCSDKBitmojiKit/SCSDKBitmojiKit.h>
#import <SCSDKLoginKit/SCSDKLoginKit.h>

@implementation RNSnapKit

RCT_EXPORT_MODULE();

- (NSArray<NSString *> *)supportedEvents {
  return @[];
}

RCT_EXPORT_METHOD(login : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject) {
  [SCSDKLoginClient
      loginFromViewController:[UIApplication sharedApplication]
                                  .delegate.window.rootViewController
                   completion:^(BOOL success, NSError *_Nullable error) {
                     if (error) {
                       reject(@"login_error", error.localizedDescription,
                              error);
                     } else if (success) {
                       // Fetch Auth Token / Code to send to backend
                       [SCSDKLoginClient getAccessTokenWithCompletion:^(
                                             NSString *_Nullable accessToken,
                                             NSError *_Nullable error) {
                         if (accessToken) {
                           resolve(@{@"accessToken" : accessToken});
                         } else {
                           reject(@"token_error", @"Failed to get access token",
                                  error);
                         }
                       }];
                     } else {
                       reject(@"login_cancelled", @"User cancelled login", nil);
                     }
                   }];
}

RCT_EXPORT_METHOD(isLoggedIn : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject) {
  resolve(@([SCSDKLoginClient isUserLoggedIn]));
}

RCT_EXPORT_METHOD(logout : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject) {
  [SCSDKLoginClient clearToken];
  resolve(@(YES));
}

RCT_EXPORT_METHOD(fetchUserData : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject) {
  NSString *query = @"{me{displayName, bitmoji{avatar, id}}}";
  [SCSDKLoginClient fetchUserDataWithQuery:query
      variables:nil
      success:^(NSDictionary *_Nullable resources) {
        NSDictionary *me = resources[@"data"][@"me"];
        resolve(me);
      }
      failure:^(NSError *_Nullable error, BOOL isUserLoggedOut) {
        reject(@"fetch_error", error.localizedDescription, error);
      }];
}

@end
