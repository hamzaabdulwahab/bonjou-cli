class Bonjou < Formula
  desc "Terminal-based LAN chat and transfer application"
  homepage "https://github.com/hamzaabdulwahab/bonjou-cli"
  version "1.0.0"

  on_macos do
    url "https://github.com/hamzaabdulwahab/bonjou-cli/releases/download/v1.0.0/bonjou-macos"
    sha256 "72332a2209f01ee0b9d192500293088e99a435fff22608df30d77b187d381fac"
  end

  def install
    bin.install "bonjou-macos" => "bonjou"
  end

  def caveats
    <<~EOS
      Bonjou expects UDP discovery on port 46320 and TCP messaging on port 46321.
      Ensure these ports are open on your firewall.
    EOS
  end

  test do
    pipe_output("#{bin}/bonjou", "@exit\n")
  end
end
