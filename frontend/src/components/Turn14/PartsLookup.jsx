import React, { useState } from 'react';
import api from '../../utils/api';

const PartsLookup = ({ onPartSelect, showOrderButton = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [partDetails, setPartDetails] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState(null);
  const [searchMode, setSearchMode] = useState('query'); // 'query', 'partNumber', 'vehicle'

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setParts([]);
    setSelectedPart(null);
    setPartDetails(null);
    setPricing(null);
    setAvailability(null);

    try {
      const params = {};
      
      if (searchMode === 'query' && searchQuery.trim()) {
        params.query = searchQuery.trim();
      } else if (searchMode === 'partNumber' && partNumber.trim()) {
        params.partNumber = partNumber.trim();
      } else if (searchMode === 'vehicle') {
        if (make.trim()) params.make = make.trim();
        if (model.trim()) params.model = model.trim();
        if (year.trim()) params.year = year.trim();
      }

      if (Object.keys(params).length === 0) {
        setError('Please enter a search query, part number, or vehicle information');
        setLoading(false);
        return;
      }

      params.limit = 50; // Limit results

      const response = await api.get('/turn14/parts/search', { params });
      setParts(response.data.parts || []);
      
      if (response.data.parts && response.data.parts.length === 0) {
        setError('No parts found. Try a different search.');
      }
    } catch (error) {
      console.error('Turn14 search error:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to search parts';
      setError(errorMessage);
      
      if (errorMessage.includes('API key not configured')) {
        setError('Turn14 API key not configured. Please add TURN14_API_KEY to backend/.env file and restart the server.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePartClick = async (part) => {
    setSelectedPart(part);
    setLoadingDetails(true);
    setPartDetails(null);
    setPricing(null);
    setAvailability(null);

    try {
      // Get detailed part information
      const partNum = part.partNumber || part.part_number || part.sku || part.number;
      if (partNum) {
        // Fetch part details, pricing, and availability in parallel
        const [detailsRes, pricingRes, availabilityRes] = await Promise.allSettled([
          api.get(`/turn14/parts/${encodeURIComponent(partNum)}`),
          api.get(`/turn14/parts/${encodeURIComponent(partNum)}/pricing`),
          api.get(`/turn14/parts/${encodeURIComponent(partNum)}/availability`)
        ]);

        if (detailsRes.status === 'fulfilled') {
          setPartDetails(detailsRes.value.data.part);
        }
        if (pricingRes.status === 'fulfilled') {
          setPricing(pricingRes.value.data.pricing);
        }
        if (availabilityRes.status === 'fulfilled') {
          setAvailability(availabilityRes.value.data.availability);
        }
      } else {
        // If no part number, use the part data we already have
        setPartDetails(part);
      }
    } catch (error) {
      console.error('Error fetching part details:', error);
      // Use the part data we already have as fallback
      setPartDetails(part);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSelectPart = () => {
    if (selectedPart && onPartSelect) {
      onPartSelect({
        ...selectedPart,
        details: partDetails,
        pricing: pricing,
        availability: availability
      });
    }
  };

  const formatPrice = (price) => {
    if (typeof price === 'number') {
      return `$${price.toFixed(2)}`;
    }
    if (typeof price === 'string') {
      return price;
    }
    if (price && price.amount) {
      return `$${parseFloat(price.amount).toFixed(2)}`;
    }
    if (price && price.value) {
      return `$${parseFloat(price.value).toFixed(2)}`;
    }
    return 'N/A';
  };

  const getPartNumber = (part) => {
    return part.partNumber || part.part_number || part.sku || part.number || part.id || 'N/A';
  };

  const getPartName = (part) => {
    return part.name || part.description || part.title || part.productName || 'Unknown Part';
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4">Turn14 Parts Lookup</h3>
        
        {/* Search Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSearchMode('query')}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              searchMode === 'query' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Search
          </button>
          <button
            onClick={() => setSearchMode('partNumber')}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              searchMode === 'partNumber' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Part Number
          </button>
          <button
            onClick={() => setSearchMode('vehicle')}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              searchMode === 'vehicle' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Vehicle
          </button>
        </div>

        {/* Search Form */}
        <div className="space-y-3">
          {searchMode === 'query' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Parts
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter part name, description, or keyword..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {searchMode === 'partNumber' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Part Number
              </label>
              <input
                type="text"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter part number..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {searchMode === 'vehicle' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="Year"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Make
                </label>
                <input
                  type="text"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="Make"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Model"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search Parts'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Search Results */}
      {parts.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="text-lg font-semibold mb-4">
            Search Results ({parts.length})
          </h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {parts.map((part, index) => (
              <div
                key={index}
                onClick={() => handlePartClick(part)}
                className={`p-4 border rounded-lg cursor-pointer transition ${
                  selectedPart === part
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">
                      {getPartName(part)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Part #: {getPartNumber(part)}
                    </div>
                    {part.price && (
                      <div className="text-lg font-bold text-green-600 mt-2">
                        {formatPrice(part.price)}
                      </div>
                    )}
                  </div>
                  {part.availability !== undefined && (
                    <div className={`px-2 py-1 rounded text-xs ${
                      part.availability || part.inStock
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {part.availability || part.inStock ? 'In Stock' : 'Out of Stock'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Part Details */}
      {selectedPart && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="text-lg font-semibold mb-4">Part Details</h4>
          
          {loadingDetails ? (
            <div className="text-center py-4">Loading details...</div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-2xl font-bold text-gray-800">
                  {getPartName(partDetails || selectedPart)}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Part Number: {getPartNumber(partDetails || selectedPart)}
                </div>
              </div>

              {pricing && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="font-semibold text-gray-700 mb-2">Pricing</div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatPrice(pricing)}
                  </div>
                  {pricing.quantity && (
                    <div className="text-sm text-gray-600 mt-1">
                      Quantity: {pricing.quantity}
                    </div>
                  )}
                </div>
              )}

              {availability && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="font-semibold text-gray-700 mb-2">Availability</div>
                  <div className={`inline-block px-3 py-1 rounded ${
                    availability.inStock || availability.available
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {availability.inStock || availability.available ? 'In Stock' : 'Out of Stock'}
                  </div>
                  {availability.quantity && (
                    <div className="text-sm text-gray-600 mt-2">
                      Quantity Available: {availability.quantity}
                    </div>
                  )}
                </div>
              )}

              {(partDetails || selectedPart) && (partDetails || selectedPart).description && (
                <div>
                  <div className="font-semibold text-gray-700 mb-2">Description</div>
                  <div className="text-gray-600">
                    {(partDetails || selectedPart).description}
                  </div>
                </div>
              )}

              {onPartSelect && (
                <button
                  onClick={handleSelectPart}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                >
                  Select Part
                </button>
              )}

              {showOrderButton && (
                <button
                  onClick={() => {
                    // TODO: Implement order functionality
                    alert('Order functionality coming soon!');
                  }}
                  className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
                >
                  Add to Order
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PartsLookup;
