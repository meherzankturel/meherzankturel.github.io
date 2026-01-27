import WidgetKit
import SwiftUI

struct DistanceProvider: TimelineProvider {
    func placeholder(in context: Context) -> DistanceEntry {
        DistanceEntry(date: Date(), distance: "1,234 km", yourMood: "😊", partnerMood: "💕", yourName: "You", partnerName: "Partner", yourAvatarUrl: nil, partnerAvatarUrl: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (DistanceEntry) -> ()) {
        let entry = DistanceEntry(
            date: Date(),
            distance: SharedData.distance,
            yourMood: SharedData.yourMood,
            partnerMood: SharedData.partnerMood,
            yourName: SharedData.yourName,
            partnerName: SharedData.partnerName,
            yourAvatarUrl: SharedData.yourAvatarUrl,
            partnerAvatarUrl: SharedData.partnerAvatarUrl
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let entry = DistanceEntry(
            date: Date(),
            distance: SharedData.distance,
            yourMood: SharedData.yourMood,
            partnerMood: SharedData.partnerMood,
            yourName: SharedData.yourName,
            partnerName: SharedData.partnerName,
            yourAvatarUrl: SharedData.yourAvatarUrl,
            partnerAvatarUrl: SharedData.partnerAvatarUrl
        )
        
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

struct DistanceEntry: TimelineEntry {
    let date: Date
    let distance: String
    let yourMood: String
    let partnerMood: String
    let yourName: String
    let partnerName: String
    let yourAvatarUrl: String?
    let partnerAvatarUrl: String?
}

struct DistanceWidgetEntryView: View {
    var entry: DistanceProvider.Entry
    @Environment(\.widgetFamily) var family
    
    var body: some View {
        ZStack {
            // Dark map-like background
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 0.08, green: 0.09, blue: 0.12),
                    Color(red: 0.12, green: 0.14, blue: 0.18)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            
            // Subtle grid pattern
            GeometryReader { geo in
                Path { path in
                    let spacing: CGFloat = 20
                    for x in stride(from: 0, to: geo.size.width, by: spacing) {
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x, y: geo.size.height))
                    }
                    for y in stride(from: 0, to: geo.size.height, by: spacing) {
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: geo.size.width, y: y))
                    }
                }
                .stroke(Color.white.opacity(0.03), lineWidth: 0.5)
            }
            
            VStack(spacing: family == .systemSmall ? 8 : 12) {
                // Partner avatars with mood bubbles
                HStack(spacing: family == .systemSmall ? 30 : 50) {
                    // Your avatar
                    VStack(spacing: 4) {
                        ZStack(alignment: .top) {
                            // Mood bubble
                            Text(entry.yourMood)
                                .font(.system(size: family == .systemSmall ? 14 : 18))
                                .padding(4)
                                .background(Color.white.opacity(0.15))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .offset(y: -8)
                            
                            // Avatar
                            AsyncAvatarView(urlString: entry.yourAvatarUrl, size: family == .systemSmall ? 40 : 50, borderColor: .blue)
                                .offset(y: family == .systemSmall ? 14 : 16)
                        }
                        
                        if family != .systemSmall {
                            Text(entry.yourName)
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.7))
                                .offset(y: 8)
                        }
                    }
                    
                    // Partner avatar
                    VStack(spacing: 4) {
                        ZStack(alignment: .top) {
                            // Mood bubble
                            Text(entry.partnerMood)
                                .font(.system(size: family == .systemSmall ? 14 : 18))
                                .padding(4)
                                .background(Color.white.opacity(0.15))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .offset(y: -8)
                            
                            // Avatar
                            AsyncAvatarView(urlString: entry.partnerAvatarUrl, size: family == .systemSmall ? 40 : 50, borderColor: .pink)
                                .offset(y: family == .systemSmall ? 14 : 16)
                        }
                        
                        if family != .systemSmall {
                            Text(entry.partnerName)
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.7))
                                .offset(y: 8)
                        }
                    }
                }
                
                Spacer().frame(height: family == .systemSmall ? 4 : 8)
                
                // Distance display
                HStack(spacing: 4) {
                    Image(systemName: "location.fill")
                        .font(.system(size: family == .systemSmall ? 10 : 12))
                        .foregroundColor(.pink)
                    
                    Text(entry.distance)
                        .font(.system(size: family == .systemSmall ? 16 : 20, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    Capsule()
                        .fill(Color.white.opacity(0.1))
                        .overlay(
                            Capsule()
                                .strokeBorder(
                                    LinearGradient(
                                        gradient: Gradient(colors: [.pink.opacity(0.5), .purple.opacity(0.5)]),
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    ),
                                    lineWidth: 1
                                )
                        )
                )
            }
            .padding()
        }
    }
}

struct AsyncAvatarView: View {
    let urlString: String?
    let size: CGFloat
    let borderColor: Color
    
    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        gradient: Gradient(colors: [borderColor, borderColor.opacity(0.6)]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size + 4, height: size + 4)
            
            Circle()
                .fill(Color(red: 0.15, green: 0.16, blue: 0.2))
                .frame(width: size, height: size)
            
            Image(systemName: "person.fill")
                .font(.system(size: size * 0.4))
                .foregroundColor(.white.opacity(0.5))
        }
    }
}

struct DistanceWidget: Widget {
    let kind: String = "DistanceWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DistanceProvider()) { entry in
            DistanceWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Distance")
        .description("See the distance between you and your partner.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}


