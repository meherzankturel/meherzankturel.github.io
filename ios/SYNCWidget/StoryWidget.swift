import WidgetKit
import SwiftUI

struct StoryProvider: TimelineProvider {
    func placeholder(in context: Context) -> StoryEntry {
        StoryEntry(
            date: Date(),
            yourMomentUrl: nil,
            yourMomentCaption: "Your moment",
            partnerMomentUrl: nil,
            partnerMomentCaption: "Partner's moment",
            yourName: "You",
            partnerName: "Partner"
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (StoryEntry) -> ()) {
        let entry = StoryEntry(
            date: Date(),
            yourMomentUrl: SharedData.yourMomentUrl,
            yourMomentCaption: SharedData.yourMomentCaption,
            partnerMomentUrl: SharedData.partnerMomentUrl,
            partnerMomentCaption: SharedData.partnerMomentCaption,
            yourName: SharedData.yourName,
            partnerName: SharedData.partnerName
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let entry = StoryEntry(
            date: Date(),
            yourMomentUrl: SharedData.yourMomentUrl,
            yourMomentCaption: SharedData.yourMomentCaption,
            partnerMomentUrl: SharedData.partnerMomentUrl,
            partnerMomentCaption: SharedData.partnerMomentCaption,
            yourName: SharedData.yourName,
            partnerName: SharedData.partnerName
        )
        
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

struct StoryEntry: TimelineEntry {
    let date: Date
    let yourMomentUrl: String?
    let yourMomentCaption: String?
    let partnerMomentUrl: String?
    let partnerMomentCaption: String?
    let yourName: String
    let partnerName: String
}

struct StoryWidgetEntryView: View {
    var entry: StoryProvider.Entry
    @Environment(\.widgetFamily) var family
    
    var body: some View {
        GeometryReader { geo in
            HStack(spacing: 2) {
                // Your moment (left side)
                MomentCardView(
                    momentUrl: entry.yourMomentUrl,
                    caption: entry.yourMomentCaption,
                    name: entry.yourName,
                    isLeft: true,
                    size: CGSize(width: geo.size.width / 2 - 1, height: geo.size.height)
                )
                
                // Partner's moment (right side)
                MomentCardView(
                    momentUrl: entry.partnerMomentUrl,
                    caption: entry.partnerMomentCaption,
                    name: entry.partnerName,
                    isLeft: false,
                    size: CGSize(width: geo.size.width / 2 - 1, height: geo.size.height)
                )
            }
        }
    }
}

struct MomentCardView: View {
    let momentUrl: String?
    let caption: String?
    let name: String
    let isLeft: Bool
    let size: CGSize
    
    var body: some View {
        ZStack(alignment: .bottom) {
            // Background
            if momentUrl != nil {
                // Placeholder for async image - in production would use actual async loading
                Rectangle()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                isLeft ? Color.blue.opacity(0.3) : Color.pink.opacity(0.3),
                                isLeft ? Color.purple.opacity(0.2) : Color.orange.opacity(0.2)
                            ]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                
                // Camera icon as placeholder
                VStack {
                    Image(systemName: "photo.fill")
                        .font(.system(size: 24))
                        .foregroundColor(.white.opacity(0.5))
                }
            } else {
                // No moment placeholder
                Rectangle()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color(red: 0.15, green: 0.16, blue: 0.2),
                                Color(red: 0.1, green: 0.11, blue: 0.14)
                            ]),
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                
                VStack(spacing: 8) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 20))
                        .foregroundColor(.white.opacity(0.4))
                    
                    Text("No moment yet")
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.4))
                }
            }
            
            // Caption overlay at bottom
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.white)
                
                if let caption = caption, !caption.isEmpty {
                    Text(caption)
                        .font(.system(size: 9))
                        .foregroundColor(.white.opacity(0.8))
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(8)
            .background(
                LinearGradient(
                    gradient: Gradient(colors: [.clear, .black.opacity(0.7)]),
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
        .frame(width: size.width, height: size.height)
        .clipped()
    }
}

struct StoryWidget: Widget {
    let kind: String = "StoryWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StoryProvider()) { entry in
            StoryWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Today's Moments")
        .description("See today's moments from you and your partner.")
        .supportedFamilies([.systemMedium])
    }
}


