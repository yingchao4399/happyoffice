// Windows 系统打印桥：只接收本机生成的 PDF，通过 WinRT 逐页渲染和 GDI 打印。
// 打印机设置属于本次任务，不修改系统打印机默认值。保持 C# 5 兼容。
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Printing;
using System.IO;
using System.Collections.Generic;
using System.ComponentModel;
using System.Text;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Threading.Tasks;
using Windows.Data.Pdf;
using Windows.Storage;
using Windows.Storage.Streams;

sealed class PrintRequest {
    public string pdfPath { get; set; }
    public string title { get; set; }
    public bool? landscape { get; set; }
    public bool? color { get; set; }
    public int copies { get; set; }
    public bool? collate { get; set; }
    public PrintRangeRequest[] pageRanges { get; set; }
    public string duplexMode { get; set; }
    public int paperWidth { get; set; }
    public int paperHeight { get; set; }
}

sealed class PrintRangeRequest {
    public int from { get; set; }
    public int to { get; set; }
}

static class SystemPrint {
    static Bitmap RenderPage(PdfPage page) {
        using (var random = new InMemoryRandomAccessStream()) {
            double scale = Math.Min(200.0 / 96.0, Math.Sqrt(16000000.0 / (page.Size.Width * page.Size.Height)));
            Task.Run(async delegate { await page.RenderToStreamAsync(random, new PdfPageRenderOptions {
                DestinationWidth = (uint)Math.Max(1, Math.Round(page.Size.Width * scale)),
                DestinationHeight = (uint)Math.Max(1, Math.Round(page.Size.Height * scale))
            }).AsTask().ConfigureAwait(false); }).GetAwaiter().GetResult();
            random.Seek(0);
            using (var stream = random.AsStreamForRead())
            using (var image = Image.FromStream(stream)) return new Bitmap(image);
        }
    }

    [STAThread]
    static int Main() {
        try {
            Console.InputEncoding = new UTF8Encoding(false);
            Console.OutputEncoding = new UTF8Encoding(false);
            Application.EnableVisualStyles();
            var request = new JavaScriptSerializer().Deserialize<PrintRequest>(Console.In.ReadToEnd());
            if (request == null || !Path.IsPathRooted(request.pdfPath) || !File.Exists(request.pdfPath))
                throw new ArgumentException("invalid request");
            Console.Error.WriteLine("pdf-load-start");
            // WinRT I/O 在 MTA 执行，不能在原生对话框的 STA 上同步阻塞回调。
            var pdf = Task.Run(async delegate {
                var file = await StorageFile.GetFileFromPathAsync(request.pdfPath).AsTask().ConfigureAwait(false);
                return await PdfDocument.LoadFromFileAsync(file).AsTask().ConfigureAwait(false);
            }).GetAwaiter().GetResult();
            Console.Error.WriteLine("pdf-ready");
            if (pdf.PageCount == 0) throw new InvalidDataException("empty document");
            var selection = new SortedSet<int>();
            if (request.pageRanges != null) foreach (var range in request.pageRanges) {
                if (range.from < 0 || range.to < range.from || range.from >= pdf.PageCount || range.to >= pdf.PageCount)
                    throw new ArgumentException("invalid page range");
                for (int i = range.from; i <= range.to; i++) selection.Add(i);
            }
            using (var document = new PrintDocument()) {
                document.DocumentName = String.IsNullOrWhiteSpace(request.title) ? "Friday" : request.title;
                document.PrintController = new StandardPrintController();
                document.DefaultPageSettings.Margins = new Margins(0, 0, 0, 0);
                using (var first = pdf.GetPage(0))
                    document.DefaultPageSettings.Landscape = request.landscape ?? first.Size.Width > first.Size.Height;
                if (request.color.HasValue) document.DefaultPageSettings.Color = request.color.Value;
                document.PrinterSettings.Copies = (short)Math.Max(1, Math.Min(999, request.copies));
                if (request.collate.HasValue) document.PrinterSettings.Collate = request.collate.Value;
                if (document.PrinterSettings.CanDuplex && request.duplexMode != null)
                    document.PrinterSettings.Duplex = request.duplexMode == "longEdge" ? Duplex.Vertical : request.duplexMode == "shortEdge" ? Duplex.Horizontal : Duplex.Simplex;
                // 原生纸张单位为 1/100 英寸，输入单位为微米。
                if (request.paperWidth > 0 && request.paperHeight > 0) {
                    int w = (int)Math.Round(request.paperWidth / 254.0), h = (int)Math.Round(request.paperHeight / 254.0);
                    PaperSize paper = null;
                    foreach (PaperSize available in document.PrinterSettings.PaperSizes)
                        if (Math.Abs(available.Width - w) <= 2 && Math.Abs(available.Height - h) <= 2) { paper = available; break; }
                    document.DefaultPageSettings.PaperSize = paper ?? new PaperSize("Friday", w, h);
                }
                // 使用独立且可见的本进程预览 owner。跨进程的隐藏 owner 会导致
                // 系统打印框无法从任务栏/辅助功能定位，保存框也难以获得焦点。
                using (var preview = new Form())
                using (var first = pdf.GetPage(0))
                using (var firstImage = RenderPage(first))
                using (var picture = new PictureBox())
                using (var dialog = new PrintDialog()) {
                    preview.Text = document.DocumentName;
                    preview.Size = new Size(900, 700);
                    preview.StartPosition = FormStartPosition.CenterScreen;
                    picture.Dock = DockStyle.Fill;
                    picture.SizeMode = PictureBoxSizeMode.Zoom;
                    picture.BackColor = System.Drawing.Color.WhiteSmoke;
                    picture.Image = firstImage;
                    preview.Controls.Add(picture);
                    preview.Show();
                    preview.Refresh();
                    preview.Activate();
                    dialog.Document = document;
                    dialog.UseEXDialog = true;
                    dialog.AllowSomePages = true;
                    dialog.AllowSelection = selection.Count > 0;
                    dialog.AllowPrintToFile = false;
                    document.PrinterSettings.MinimumPage = 1;
                    document.PrinterSettings.MaximumPage = (int)pdf.PageCount;
                    document.PrinterSettings.FromPage = 1;
                    document.PrinterSettings.ToPage = (int)pdf.PageCount;
                    if (selection.Count > 0) document.PrinterSettings.PrintRange = PrintRange.Selection;
                    Console.Error.WriteLine("dialog-open");
                    if (dialog.ShowDialog(preview) != DialogResult.OK) {
                        Console.WriteLine("{\"success\":false,\"failureReason\":\"Print job canceled\"}");
                        return 0;
                    }
                var targets = new List<int>();
                if (document.PrinterSettings.PrintRange == PrintRange.Selection) targets.AddRange(selection);
                else {
                    int start = document.PrinterSettings.PrintRange == PrintRange.SomePages ? Math.Max(0, document.PrinterSettings.FromPage - 1) : 0;
                    int end = document.PrinterSettings.PrintRange == PrintRange.SomePages ? Math.Min((int)pdf.PageCount, document.PrinterSettings.ToPage) : (int)pdf.PageCount;
                    for (int i = start; i < end; i++) targets.Add(i);
                }
                if (targets.Count == 0) throw new ArgumentException("empty page range");
                int current = 0;
                document.PrintPage += delegate(object sender, PrintPageEventArgs e) {
                    using (var page = pdf.GetPage((uint)targets[current]))
                    using (var image = RenderPage(page)) {
                            // 根据用户最后选择的纸张等比居中，保持文本方向，禁止自动旋转。
                            float hardX = e.PageSettings.HardMarginX, hardY = e.PageSettings.HardMarginY;
                            float width = e.PageBounds.Width - hardX * 2, height = e.PageBounds.Height - hardY * 2;
                            float fit = Math.Min(width / image.Width, height / image.Height);
                            var target = new RectangleF((width - image.Width * fit) / 2, (height - image.Height * fit) / 2, image.Width * fit, image.Height * fit);
                            using (var attributes = new ImageAttributes()) {
                                if (!e.PageSettings.Color) attributes.SetColorMatrix(new ColorMatrix(new float[][] {
                                    new float[]{.299f,.299f,.299f,0,0}, new float[]{.587f,.587f,.587f,0,0}, new float[]{.114f,.114f,.114f,0,0}, new float[]{0,0,0,1,0}, new float[]{0,0,0,0,1}
                                }));
                                e.Graphics.DrawImage(image, Rectangle.Round(target), 0, 0, image.Width, image.Height, GraphicsUnit.Pixel, attributes);
                            }
                    }
                    current++;
                    e.HasMorePages = current < targets.Count;
                };
                Console.Error.WriteLine("print-start");
                document.Print();
                }
            }
            Console.WriteLine("{\"success\":true,\"failureReason\":\"\"}");
            return 0;
        } catch (Exception error) {
            var native = error as Win32Exception;
            if ((native != null && native.NativeErrorCode == 1223) || error.HResult == unchecked((int)0x800704C7)) {
                Console.WriteLine("{\"success\":false,\"failureReason\":\"Print job canceled\"}");
                return 0;
            }
            // 不输出源路径、正文或驱动返回的用户数据。
            Console.Error.WriteLine(error.GetType().Name + ":" + error.HResult);
            Console.WriteLine("{\"success\":false,\"failureReason\":\"WINDOWS_PRINT_FAILED\"}");
            return 1;
        }
    }
}
