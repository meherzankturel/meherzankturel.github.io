import Foundation
import SwiftUI

struct SharedData {
    static let appGroup = "group.com.sync.app"
    
    static var userDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroup)
    }
    
    // MARK: - Distance Data
    static var distance: String {
        userDefaults?.string(forKey: "distance") ?? "-- km"
    }
    
    static var yourCity: String {
        userDefaults?.string(forKey: "yourCity") ?? "Your City"
    }
    
    static var partnerCity: String {
        userDefaults?.string(forKey: "partnerCity") ?? "Partner's City"
    }
    
    static var yourName: String {
        userDefaults?.string(forKey: "yourName") ?? "You"
    }
    
    static var partnerName: String {
        userDefaults?.string(forKey: "partnerName") ?? "Partner"
    }
    
    // MARK: - Profile Data
    static var yourAvatarUrl: String? {
        userDefaults?.string(forKey: "yourAvatarUrl")
    }
    
    static var partnerAvatarUrl: String? {
        userDefaults?.string(forKey: "partnerAvatarUrl")
    }
    
    // MARK: - Mood Data
    static var yourMood: String {
        userDefaults?.string(forKey: "yourMood") ?? "😊"
    }
    
    static var partnerMood: String {
        userDefaults?.string(forKey: "partnerMood") ?? "😊"
    }
    
    // MARK: - Location Data
    static var yourLatitude: Double {
        userDefaults?.double(forKey: "yourLatitude") ?? 0.0
    }
    
    static var yourLongitude: Double {
        userDefaults?.double(forKey: "yourLongitude") ?? 0.0
    }
    
    static var partnerLatitude: Double {
        userDefaults?.double(forKey: "partnerLatitude") ?? 0.0
    }
    
    static var partnerLongitude: Double {
        userDefaults?.double(forKey: "partnerLongitude") ?? 0.0
    }
    
    // MARK: - Moment Data
    static var yourMomentUrl: String? {
        userDefaults?.string(forKey: "yourMomentUrl")
    }
    
    static var yourMomentCaption: String? {
        userDefaults?.string(forKey: "yourMomentCaption")
    }
    
    static var partnerMomentUrl: String? {
        userDefaults?.string(forKey: "partnerMomentUrl")
    }
    
    static var partnerMomentCaption: String? {
        userDefaults?.string(forKey: "partnerMomentCaption")
    }
    
    // MARK: - Helper Methods
    static func loadImage(from urlString: String?, completion: @escaping (UIImage?) -> Void) {
        guard let urlString = urlString, let url = URL(string: urlString) else {
            completion(nil)
            return
        }
        
        URLSession.shared.dataTask(with: url) { data, _, _ in
            if let data = data, let image = UIImage(data: data) {
                completion(image)
            } else {
                completion(nil)
            }
        }.resume()
    }
}
