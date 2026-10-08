using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Zekra.Core;

namespace Zekra.Desktop;

/// <summary>Hisn al-Muslim by chapter, each zikr with a counter for its repeats.</summary>
public sealed partial class AzkarWindow : Window
{
    readonly Chapter[] _all = App.Current.Data.Azkar;

    public AzkarWindow()
    {
        InitializeComponent();
        Win.Setup(this, "الأذكار — ذِكرى", 1040, 760);
        Win.TitleBar(this, TitleBar);
        LogoHost.Content = Win.Logo(22, Root.ActualTheme);
        Root.ActualThemeChanged += (_, _) => LogoHost.Content = Win.Logo(22, Root.ActualTheme);
        Chapters.ItemsSource = _all;
        // Morning and evening first: what most people open it for.
        Chapters.SelectedItem = _all.FirstOrDefault(c => c.Title.Contains("الصباح")) ?? _all[0];
        Chapters.Loaded += (_, _) => Chapters.ScrollIntoView(Chapters.SelectedItem, ScrollIntoViewAlignment.Leading);
    }

    void OnSearch(AutoSuggestBox sender, AutoSuggestBoxTextChangedEventArgs e)
    {
        var q = Fold(sender.Text);
        Chapters.ItemsSource = q.Length == 0 ? _all : _all.Where(c => Fold(c.Title).Contains(q)).ToArray();
    }

    /// <summary>Letters only, so «الاذان» finds «الآذان».</summary>
    static string Fold(string s) => new string(s.Where(ch => ch is < 'ً' or > 'ٟ' and not 'ٰ').ToArray())
        .Replace('أ', 'ا').Replace('إ', 'ا').Replace('آ', 'ا').Replace('ى', 'ي').Replace('ة', 'ه').Trim();

    void OnChapter(object sender, SelectionChangedEventArgs e) => Show();

    void OnReset(object sender, RoutedEventArgs e) => Show();

    void Show()
    {
        if (Chapters.SelectedItem is not Chapter chapter) return;
        ChapterTitle.Text = chapter.Title;
        Items.Children.Clear();
        foreach (var item in chapter.Items) Items.Children.Add(Card(item));
        ItemsScroll.ChangeView(null, 0, null, true);
    }

    FrameworkElement Card(ZikrItem item)
    {
        var left = Math.Max(1, item.Repeat);
        var text = new TextBlock
        {
            Text = item.Text,
            FontFamily = (FontFamily)Application.Current.Resources["ZikrFont"],
            FontSize = 26,
            TextWrapping = TextWrapping.Wrap,
            IsTextSelectionEnabled = true,
            LineHeight = 44,
        };
        var count = new TextBlock { Text = Arabic.Digits(left), FontSize = 18, FontWeight = Microsoft.UI.Text.FontWeights.SemiBold, VerticalAlignment = VerticalAlignment.Center };
        var icon = new FontIcon { Glyph = "\uE73E", FontSize = 14, Visibility = Visibility.Collapsed };
        var button = new Button
        {
            Content = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, Children = { icon, count } },
            HorizontalAlignment = HorizontalAlignment.Right,
            Style = (Style)Application.Current.Resources["AccentButtonStyle"],
            MinWidth = 88,
        };
        ToolTipService.SetToolTip(button, "اضغط بعد كل مرة");
        Microsoft.UI.Xaml.Automation.AutomationProperties.SetName(button, "عدّ مرة");
        var card = new Border
        {
            Style = (Style)Application.Current.Resources["Card"],
            Child = new StackPanel { Spacing = 10, Children = { text, button } },
        };
        button.Click += (_, _) =>
        {
            if (left == 0) return;
            left--;
            count.Text = Arabic.Digits(left);
            if (left > 0) return;
            icon.Visibility = Visibility.Visible;
            button.Style = (Style)Application.Current.Resources["DefaultButtonStyle"];
            card.Opacity = 0.55;
        };
        return card;
    }
}
