#include "instance.hpp"

#include <algorithm>
#include <cmath>
#include <random>

static constexpr double kEarthRadiusM = 6371000.0;
static constexpr double kPi = 3.14159265358979323846;

static double to_rad(double deg) { return deg * kPi / 180.0; }

double haversine_m(double lat1, double lon1, double lat2, double lon2) {
    const double dlat = to_rad(lat2 - lat1);
    const double dlon = to_rad(lon2 - lon1);
    const double a = std::sin(dlat / 2) * std::sin(dlat / 2) +
                     std::cos(to_rad(lat1)) * std::cos(to_rad(lat2)) *
                         std::sin(dlon / 2) * std::sin(dlon / 2);
    return 2.0 * kEarthRadiusM * std::asin(std::min(1.0, std::sqrt(a)));
}

void prepare_matrix(Instance& inst) {
    const size_t n = inst.nodes.size();
    if (n < 2) {
        throw EngineError("INVALID_INSTANCE",
                          "La instancia necesita el depósito y al menos un cliente");
    }
    if (inst.distance_source == "haversine") {
        inst.matrix.assign(n, std::vector<double>(n, 0.0));
        for (size_t i = 0; i < n; ++i) {
            for (size_t j = i + 1; j < n; ++j) {
                const double d = haversine_m(inst.nodes[i].lat, inst.nodes[i].lon,
                                             inst.nodes[j].lat, inst.nodes[j].lon);
                inst.matrix[i][j] = d;
                inst.matrix[j][i] = d;
            }
        }
    } else if (inst.distance_source == "matrix") {
        if (inst.matrix.size() != n) {
            throw EngineError("INVALID_INSTANCE", "La matriz no es de n x n");
        }
        for (size_t i = 0; i < n; ++i) {
            if (inst.matrix[i].size() != n) {
                throw EngineError("INVALID_INSTANCE", "La matriz no es de n x n");
            }
            if (inst.matrix[i][i] != 0.0) {
                throw EngineError("INVALID_INSTANCE", "La diagonal de la matriz debe ser 0");
            }
            for (size_t j = 0; j < n; ++j) {
                const double d = inst.matrix[i][j];
                if (!std::isfinite(d) || d < 0.0) {
                    throw EngineError("INVALID_INSTANCE", "La matriz tiene pesos inválidos");
                }
                if (std::fabs(d - inst.matrix[j][i]) > 1e-6) {
                    throw EngineError("INVALID_INSTANCE",
                                      "La matriz debe ser simétrica (simetrícenla antes de enviarla)");
                }
            }
        }
    } else {
        throw EngineError("INVALID_INSTANCE", "distance_source desconocido");
    }
}

Instance instance_from_json(const nlohmann::json& j) {
    Instance inst;
    try {
        inst.id = j.value("id", std::string("sin-id"));
        for (const auto& nj : j.at("nodes")) {
            Node nd;
            nd.id = nj.at("id").get<int>();
            nd.name = nj.value("name", std::string());
            nd.lat = nj.at("lat").get<double>();
            nd.lon = nj.at("lon").get<double>();
            inst.nodes.push_back(nd);
        }
        inst.distance_source = j.value("distance_source", std::string("haversine"));
        if (j.contains("matrix") && !j.at("matrix").is_null()) {
            inst.matrix = j.at("matrix").get<std::vector<std::vector<double>>>();
        }
    } catch (const nlohmann::json::exception& e) {
        throw EngineError("INVALID_INSTANCE",
                          std::string("JSON de instancia inválido: ") + e.what());
    }
    for (size_t i = 0; i < inst.nodes.size(); ++i) {
        const Node& nd = inst.nodes[i];
        if (nd.id != static_cast<int>(i)) {
            throw EngineError("INVALID_INSTANCE", "Los ids de los nodos deben ser 0..n-1 en orden");
        }
        if (nd.lat < -90.0 || nd.lat > 90.0 || nd.lon < -180.0 || nd.lon > 180.0) {
            throw EngineError("INVALID_INSTANCE", "Coordenadas fuera de rango");
        }
    }
    return inst;
}

nlohmann::json instance_to_json(const Instance& inst) {
    nlohmann::json j;
    j["id"] = inst.id;
    j["nodes"] = nlohmann::json::array();
    for (const auto& nd : inst.nodes) {
        j["nodes"].push_back(
            {{"id", nd.id}, {"name", nd.name}, {"lat", nd.lat}, {"lon", nd.lon}});
    }
    j["distance_source"] = inst.distance_source;
    if (inst.distance_source == "matrix") {
        j["matrix"] = inst.matrix;
    } else {
        j["matrix"] = nullptr;
    }
    return j;
}

Instance generate_instance(int n, unsigned seed,
                           double lat_min, double lat_max,
                           double lon_min, double lon_max) {
    if (n < 2 || n > 5000) {
        throw EngineError("INVALID_INSTANCE", "n debe estar entre 2 y 5000");
    }
    // mt19937 es determinista en cualquier plataforma; se evita
    // uniform_real_distribution porque su resultado depende de la librería.
    std::mt19937 rng(seed);
    auto unit = [&rng]() {
        return static_cast<double>(rng()) / (static_cast<double>(rng.max()) + 1.0);
    };

    Instance inst;
    inst.id = "gen-n" + std::to_string(n) + "-seed" + std::to_string(seed);
    inst.distance_source = "haversine";
    for (int i = 0; i < n; ++i) {
        Node nd;
        nd.id = i;
        if (i == 0) {
            nd.name = "Centro de distribución";
        } else {
            nd.name = "Cliente " + std::to_string(i);
        }
        nd.lat = lat_min + unit() * (lat_max - lat_min);
        nd.lon = lon_min + unit() * (lon_max - lon_min);
        inst.nodes.push_back(nd);
    }
    return inst;
}
