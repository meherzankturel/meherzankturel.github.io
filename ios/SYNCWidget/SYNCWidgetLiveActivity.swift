//
//  SYNCWidgetLiveActivity.swift
//  SYNCWidget
//
//  Created by Meherzan Turel on 2026-01-20.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct SYNCWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct SYNCWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SYNCWidgetAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension SYNCWidgetAttributes {
    fileprivate static var preview: SYNCWidgetAttributes {
        SYNCWidgetAttributes(name: "World")
    }
}

extension SYNCWidgetAttributes.ContentState {
    fileprivate static var smiley: SYNCWidgetAttributes.ContentState {
        SYNCWidgetAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: SYNCWidgetAttributes.ContentState {
         SYNCWidgetAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: SYNCWidgetAttributes.preview) {
   SYNCWidgetLiveActivity()
} contentStates: {
    SYNCWidgetAttributes.ContentState.smiley
    SYNCWidgetAttributes.ContentState.starEyes
}
