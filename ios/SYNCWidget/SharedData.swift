import Foundation
import WidgetKit
class SharedData {
    static let shared = SharedData()
    private let defaults: UserDefaults
    
    init() {
        defaults = UserDefaults(suiteName: "group.com.sync.app")!
    }
    
    var partnerDistance: Double? {
        get {
            let value = defaults.double(forKey: "partner_distance")
            return value > 0 ? value : nil
        }
    }
    
    var yourCity: String? {
        defaults.string(forKey: "your_city")
    }
    
    var partnerCity: String? {
        defaults.string(forKey: "partner_city")
    }
    
    var partnerName: String? {
        defaults.string(forKey: "partner_name")
    }
}
