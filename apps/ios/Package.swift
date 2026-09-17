// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "WewedIOS",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(name: "WewedKit", targets: ["WewedKit"]),
        .executable(name: "WewedApp", targets: ["WewedApp"])
    ],
    dependencies: [],
    targets: [
        .target(
            name: "WewedKit",
            dependencies: [],
            path: "Wewed",
            exclude: ["AppTarget", "Tests"]
        ),
        .executableTarget(
            name: "WewedApp",
            dependencies: ["WewedKit"],
            path: "Wewed/AppTarget",
            exclude: ["Info.plist"]
        ),
        .testTarget(
            name: "WewedTests",
            dependencies: ["WewedKit"],
            path: "Wewed/Tests"
        )
    ]
)
