use anyhow::Result;
use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::num::NonZeroU32;
use std::sync::Arc;

const BASE_URL: &str = "https://wallhaven.cc/api/v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wallpaper {
    pub id: String,
    pub url: String,
    pub short_url: String,
    pub views: u64,
    pub favorites: u64,
    pub source: String,
    pub purity: String,
    pub category: String,
    pub dimension_x: u32,
    pub dimension_y: u32,
    pub resolution: String,
    pub ratio: String,
    pub file_size: u64,
    pub file_type: String,
    pub created_at: String,
    pub colors: Vec<String>,
    pub path: String,
    pub thumbs: Thumbs,
    #[serde(default)]
    pub tags: Vec<Tag>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thumbs {
    pub large: String,
    pub original: String,
    pub small: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: u64,
    pub name: String,
    pub alias: String,
    pub category_id: u64,
    pub category: String,
    pub purity: String,
    pub created_at: String,
}

fn deser_u32_or_str<'de, D: serde::Deserializer<'de>>(d: D) -> Result<u32, D::Error> {
    use serde::de::{self, Visitor};
    struct V;
    impl<'de> Visitor<'de> for V {
        type Value = u32;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("u32 or string")
        }
        fn visit_u64<E: de::Error>(self, v: u64) -> Result<u32, E> { Ok(v as u32) }
        fn visit_i64<E: de::Error>(self, v: i64) -> Result<u32, E> { Ok(v as u32) }
        fn visit_str<E: de::Error>(self, v: &str) -> Result<u32, E> {
            v.parse().map_err(de::Error::custom)
        }
    }
    d.deserialize_any(V)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Meta {
    pub current_page: u32,
    pub last_page: u32,
    #[serde(deserialize_with = "deser_u32_or_str")]
    pub per_page: u32,
    pub total: u64,
    pub query: Option<serde_json::Value>,
    pub seed: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub data: Vec<Wallpaper>,
    pub meta: Meta,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SearchParams {
    pub q: Option<String>,
    /// 3-bit mask: general/anime/people e.g. "111"
    pub categories: Option<String>,
    /// 3-bit mask: sfw/sketchy/nsfw e.g. "100"
    pub purity: Option<String>,
    /// date_added | relevance | random | views | favorites | toplist
    pub sorting: Option<String>,
    /// desc | asc
    pub order: Option<String>,
    /// e.g. "1920x1080"
    pub atleast: Option<String>,
    /// e.g. "16x9,16x10"
    pub ratios: Option<String>,
    pub page: Option<u32>,
    pub seed: Option<String>,
}

pub struct WallhavenClient {
    client: Client,
    api_key: Option<String>,
    limiter: Arc<DefaultDirectRateLimiter>,
}

pub type SharedLimiter = Arc<DefaultDirectRateLimiter>;

pub fn make_limiter() -> SharedLimiter {
    let quota = Quota::per_minute(NonZeroU32::new(45).unwrap());
    Arc::new(RateLimiter::direct(quota))
}

impl WallhavenClient {
    pub fn new(api_key: Option<String>) -> Self {
        Self::with_limiter(api_key, make_limiter())
    }

    pub fn with_limiter(api_key: Option<String>, limiter: Arc<DefaultDirectRateLimiter>) -> Self {
        Self {
            client: Client::builder()
                .user_agent("wallhub/0.1")
                .build()
                .expect("HTTP client"),
            api_key,
            limiter,
        }
    }

    async fn wait_for_slot(&self) {
        while self.limiter.check().is_err() {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }
    }

    pub async fn search(&self, params: &SearchParams) -> Result<SearchResponse> {
        self.wait_for_slot().await;
        let mut req = self.client.get(format!("{BASE_URL}/search"));
        if let Some(k) = &self.api_key {
            req = req.query(&[("apikey", k.as_str())]);
        }
        if let Some(q) = &params.q {
            req = req.query(&[("q", q.as_str())]);
        }
        if let Some(c) = &params.categories {
            req = req.query(&[("categories", c.as_str())]);
        }
        if let Some(p) = &params.purity {
            req = req.query(&[("purity", p.as_str())]);
        }
        if let Some(s) = &params.sorting {
            req = req.query(&[("sorting", s.as_str())]);
        }
        if let Some(o) = &params.order {
            req = req.query(&[("order", o.as_str())]);
        }
        if let Some(a) = &params.atleast {
            req = req.query(&[("atleast", a.as_str())]);
        }
        if let Some(r) = &params.ratios {
            req = req.query(&[("ratios", r.as_str())]);
        }
        if let Some(pg) = params.page {
            req = req.query(&[("page", pg.to_string())]);
        }
        if let Some(seed) = &params.seed {
            req = req.query(&[("seed", seed.as_str())]);
        }
        let resp = req.send().await?.error_for_status()?;
        Ok(resp.json::<SearchResponse>().await?)
    }

    pub async fn get_wallpaper(&self, id: &str) -> Result<Wallpaper> {
        self.wait_for_slot().await;
        let mut req = self.client.get(format!("{BASE_URL}/w/{id}"));
        if let Some(k) = &self.api_key {
            req = req.query(&[("apikey", k.as_str())]);
        }
        #[derive(Deserialize)]
        struct WallpaperResp {
            data: Wallpaper,
        }
        let resp = req.send().await?.error_for_status()?;
        Ok(resp.json::<WallpaperResp>().await?.data)
    }

    pub async fn random(&self, params: &SearchParams) -> Result<SearchResponse> {
        let mut p = params.clone();
        p.sorting = Some("random".into());
        self.search(&p).await
    }

    pub async fn download_bytes(&self, url: &str) -> Result<bytes::Bytes> {
        self.wait_for_slot().await;
        let resp = self.client.get(url).send().await?.error_for_status()?;
        Ok(resp.bytes().await?)
    }
}
