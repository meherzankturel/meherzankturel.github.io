import WidgetKit
import SwiftUI
struct DistanceEntry: TimelineEntry {
    let date: Date
    let distance: Double?
    let yourCity: String?
    let partnerCity: String?
}
struct DistanceProvider: TimelineProvider {
    func placeholder(in context: Context) -> DistanceEntry {
        DistanceEntry(date: Date(), distance: 728, yourCity: "Your City", partnerCity: "Partner City")
    }
    
    func getSnapshot(in context: Context, completion: @escaping (DistanceEntry) -> ()) {
        let data = SharedData.shared
        let entry = DistanceEntry(
            date: Date(),
            distance: data.partnerDistance,
            yourCity: data.yourCity,
            partnerCity: data.partnerCity
        )
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let data = SharedData.shared
        let currentDate = Date()
        
        let entry = DistanceEntry(
            date: currentDate,
            distance: data.partnerDistance,
            yourCity: data.yourCity,
            partnerCity: data.partnerCity
        )
        
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: currentDate)!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}
struct DistanceWidgetView: View {
    var entry: DistanceEntry
    
    var body: some View {
        ZStack {
            Color(red: 0.04, green: 0.04, blue: 0.06) // #0A0A0F
            
            if let distance = entry.distance {
                VStack(spacing: 8) {
                    Text("\(Int(distance)) km")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(Color(red: 0, green: 0.83, blue: 1.0)) // #00D4FF
                    
                    HStack(spacing: 4) {
                        Text(entry.yourCity ?? "You")
                        Text("↔")
                        Text(entry.partnerCity ?? "Partner")
                    }
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
                }
            } else {
                Text("Open app")
                    .foregroundColor(.gray)
            }
        }
    }
}
struct DistanceWidget: Widget {
    let kind: String = "DistanceWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DistanceProvider()) { entry in
            DistanceWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Distance")
        .description("See how far you are from your partner")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
