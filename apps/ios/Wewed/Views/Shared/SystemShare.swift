import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// A file written for an explicit Share tap. Nothing leaves the device unless the person picks a destination.
public struct ShareableFile: Identifiable, Equatable {
    public let id = UUID()
    public let url: URL
}

public enum ShareFiles {
    /// Writes text to a fresh temporary file with the exact name the web workspace uses.
    public static func write(_ text: String, named fileName: String) throws -> ShareableFile {
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent("wewed-share-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let url = folder.appendingPathComponent(fileName)
        try Data(text.utf8).write(to: url, options: .atomic)
        return ShareableFile(url: url)
    }
}

/// The system share sheet for one file.
public struct ShareFileSheet: View {
    let file: ShareableFile

    public init(file: ShareableFile) {
        self.file = file
    }

    public var body: some View {
        #if canImport(UIKit)
        ActivityShareSheet(items: [file.url])
            .ignoresSafeArea()
            .presentationDetents([.medium, .large])
        #else
        VStack(spacing: 16) {
            Text(file.url.lastPathComponent).font(.headline)
            ShareLink(item: file.url) { Label("Share", systemImage: "square.and.arrow.up") }
        }
        .padding(24)
        #endif
    }
}

#if canImport(UIKit)
struct ActivityShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
#endif

/// System printing of an HTML table.
public enum WorksheetPrinter {
    public static var isAvailable: Bool {
        #if canImport(UIKit)
        return UIPrintInteractionController.isPrintingAvailable
        #else
        return false
        #endif
    }

    /// Opens the system print panel. The panel itself reports whether anything was printed.
    public static func print(html: String, jobName: String) {
        #if canImport(UIKit)
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .general
        info.jobName = jobName
        let controller = UIPrintInteractionController.shared
        controller.printInfo = info
        controller.printFormatter = UIMarkupTextPrintFormatter(markupText: html)
        controller.present(animated: true, completionHandler: nil)
        #endif
    }
}
