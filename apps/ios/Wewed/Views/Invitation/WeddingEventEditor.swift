#if canImport(EventKitUI)
import EventKit
import EventKitUI
import SwiftUI

/// QRO06 — Add to Calendar through the system event editor. It runs out of process, so the Guest
/// reviews and saves the event themselves and the app needs no calendar permission (iOS 17+).
/// Like web Ivory's calendar file, it is an ALL-DAY event on the wedding's calendar date, titled
/// "<couple> Wedding" — no time-zone guess about a stored instant.
struct WeddingEventEditor: UIViewControllerRepresentable {
    let title: String
    let location: String
    let start: Date
    let onDone: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onDone: onDone) }

    func makeUIViewController(context: Context) -> EKEventEditViewController {
        let store = EKEventStore()
        let event = EKEvent(eventStore: store)
        event.title = title
        event.location = location.isEmpty ? nil : location
        event.isAllDay = true
        event.startDate = start
        event.endDate = start
        let editor = EKEventEditViewController()
        editor.eventStore = store
        editor.event = event
        editor.editViewDelegate = context.coordinator
        return editor
    }

    func updateUIViewController(_ controller: EKEventEditViewController, context: Context) {}

    final class Coordinator: NSObject, EKEventEditViewDelegate {
        let onDone: () -> Void
        init(onDone: @escaping () -> Void) { self.onDone = onDone }
        func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
            onDone()
        }
    }
}
#endif
