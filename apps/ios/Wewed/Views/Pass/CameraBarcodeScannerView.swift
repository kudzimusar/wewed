import SwiftUI
#if canImport(AVFoundation)
import AVFoundation
#endif

/// Native camera scanner view that hooks into AVFoundation for real-time QR detection,
/// while providing an elegant fallback for simulator and test harnesses.
public struct CameraBarcodeScannerView: View {
    public let onScanned: (String) -> Void
    @State private var isCameraAuthorized: Bool = false
    @State private var hasCheckedPermission: Bool = false

    public init(onScanned: @escaping (String) -> Void) {
        self.onScanned = onScanned
    }

    public var body: some View {
        ZStack {
            Color.black

            #if os(iOS)
            if isCameraAuthorized {
                AVCaptureScannerRepresentable(onScanned: onScanned)
                    .edgesIgnoringSafeArea(.all)
            } else {
                cameraPlaceholderView
            }
            #else
            cameraPlaceholderView
            #endif

            // Target reticle, only over a live camera image
            if isCameraAuthorized {
                scannerOverlay
            }
        }
        .onAppear {
            checkCameraPermissions()
        }
    }

    private var scannerOverlay: some View {
        VStack {
            Spacer()
            ZStack {
                RoundedRectangle(cornerRadius: WewedRadius.lg)
                    .stroke(WewedColors.gold, lineWidth: 3)
                    .frame(width: 220, height: 220)

                VStack(spacing: 8) {
                    Image(systemName: "qrcode.viewfinder")
                        .font(.largeTitle)
                        .foregroundColor(WewedColors.gold.opacity(0.8))
                        .accessibilityHidden(true)
                    Text("Line up the pass QR code")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.white.opacity(0.9))
                }
            }
            Spacer()
        }
    }

    private var cameraPlaceholderView: some View {
        VStack(spacing: 12) {
            Image(systemName: "camera.viewfinder")
                .font(.largeTitle)
                .foregroundColor(WewedColors.gold)
                .accessibilityHidden(true)

            Text("Camera not available")
                .font(.headline)
                .foregroundColor(.white)

            Text("Allow camera access in Settings, or type the pass code below.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundColor(.white.opacity(0.85))
        }
        .padding()
    }

    private func checkCameraPermissions() {
        #if os(iOS) && canImport(AVFoundation)
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            isCameraAuthorized = true
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    self.isCameraAuthorized = granted
                    self.hasCheckedPermission = true
                }
            }
        default:
            isCameraAuthorized = false
            hasCheckedPermission = true
        }
        #else
        isCameraAuthorized = false
        hasCheckedPermission = true
        #endif
    }
}

#if os(iOS) && canImport(AVFoundation) && canImport(UIKit)
import UIKit

struct AVCaptureScannerRepresentable: UIViewControllerRepresentable {
    let onScanned: (String) -> Void

    func makeUIViewController(context: Context) -> ScannerViewController {
        let vc = ScannerViewController()
        vc.onScanned = onScanned
        return vc
    }

    func updateUIViewController(_ uiViewController: ScannerViewController, context: Context) {}
}

final class ScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onScanned: ((String) -> Void)?
    private let captureSession = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupCamera()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    private func setupCamera() {
        guard let videoCaptureDevice = AVCaptureDevice.default(for: .video) else { return }
        let videoInput: AVCaptureDeviceInput

        do {
            videoInput = try AVCaptureDeviceInput(device: videoCaptureDevice)
        } catch {
            return
        }

        if captureSession.canAddInput(videoInput) {
            captureSession.addInput(videoInput)
        } else {
            return
        }

        let metadataOutput = AVCaptureMetadataOutput()
        if captureSession.canAddOutput(metadataOutput) {
            captureSession.addOutput(metadataOutput)
            metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
            metadataOutput.metadataObjectTypes = [.qr]
        } else {
            return
        }

        let layer = AVCaptureVideoPreviewLayer(session: captureSession)
        layer.frame = view.layer.bounds
        layer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(layer)
        self.previewLayer = layer

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession.startRunning()
        }
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        if let metadataObject = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
           let stringValue = metadataObject.stringValue {
            AudioServicesPlaySystemSound(SystemSoundID(kSystemSoundID_Vibrate))
            captureSession.stopRunning()
            onScanned?(stringValue)
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if captureSession.isRunning {
            captureSession.stopRunning()
        }
    }
}
#endif
